import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { DriversService } from '../drivers/drivers.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProximityService } from './proximity.service';
import { findDeliveryZone } from './delivery-zones';
import {
  isKycRequired,
  productCommissionCap,
  productCommissionPct,
} from '../feature-flags/feature-flags';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private driversService: DriversService,
    private geocodingService: GeocodingService,
    private proximity: ProximityService,
    private notificationsService: NotificationsService,
  ) {}

  async create(merchantId: string, data: any) {
    // Look up the merchant profile
    const merchantProfile = await this.prisma.merchantProfile.findUnique({
      where: { userId: merchantId },
    });

    if (!merchantProfile) {
      throw new NotFoundException('Perfil de comerciante no encontrado');
    }

    // Validate inputs (all of these were Prisma 500s before).
    const orderType = data.orderType || 'immediate';
    if (orderType !== 'immediate' && orderType !== 'scheduled') {
      throw new BadRequestException(`orderType inválido: ${data.orderType}`);
    }
    if (!data.pickupAddress || !data.deliveryAddress) {
      throw new BadRequestException('pickupAddress y deliveryAddress son requeridos');
    }
    const distanceKm = await this.resolveDistanceKm(
      { lat: data.pickupLat, lng: data.pickupLng },
      { lat: data.deliveryLat, lng: data.deliveryLng },
      data.pickupAddress,
      data.deliveryAddress,
      Number(data.distanceKm ?? 0),
    );
    let scheduledDate: Date | null = null;
    if (data.scheduledDate) {
      scheduledDate = new Date(data.scheduledDate);
      if (isNaN(scheduledDate.getTime())) {
        throw new BadRequestException('scheduledDate inválida');
      }
    }
    if (orderType === 'scheduled') {
      if (!scheduledDate) {
        throw new BadRequestException('Los pedidos programados requieren scheduledDate');
      }
      // El horario programado debe ser futuro (con margen de reloj de 2 min).
      if (scheduledDate.getTime() < Date.now() - 2 * 60 * 1000) {
        throw new BadRequestException('La fecha programada ya pasó — elige una fecha futura');
      }
    }

    // Pricing: trip (zone flat or distance table) + 10% trip commission.
    // Products add the platform commission (PRODUCT_COMMISSION_PCT, default
    // 15% con tope opcional PRODUCT_COMMISSION_CAP) — el cargo lo paga el
    // cliente en el total; el comercio recibe su precio intacto.
    const kind = data.kind ?? 'food';
    if (kind !== 'food' && kind !== 'freight') {
      throw new BadRequestException('kind inválido: use food o freight');
    }

    // Server is the source of truth for prices. Menu items are re-read from
    // the DB (client-sent prices are never trusted); handwritten items keep
    // their client price but are validated and persisted as line items.
    const incomingItems: Array<Record<string, any>> = Array.isArray(data.items) ? data.items : [];
    const resolvedItems: Array<{
      menuItemId: string | null;
      name: string;
      price: number;
      quantity: number;
      notes?: string;
      selectedVariants: Array<{ group: string; option: string; priceDelta: number }>;
    }> = [];
    let productsTotal = 0;
    if (kind === 'food' && incomingItems.length > 0) {
      const menuIds = [
        ...new Set(incomingItems.map((i) => i?.menuItemId).filter(Boolean) as string[]),
      ];
      const menuItems = menuIds.length
        ? await this.prisma.menuItem.findMany({
            where: { id: { in: menuIds }, merchantId: merchantProfile.id },
          })
        : [];
      const menuById = new Map(menuItems.map((m) => [m.id, m]));

      // Variant options referenced by the cart: load once, validate
      // ownership (same merchant) + availability. Deltas come from the DB,
      // never from the client.
      const optionIds = [
        ...new Set(
          incomingItems.flatMap((i) =>
            Array.isArray(i?.variants)
              ? i.variants.map((v: any) => v?.optionId).filter(Boolean)
              : [],
          ) as string[],
        ),
      ];
      const dbOptions = optionIds.length
        ? await this.prisma.menuItemVariantOption.findMany({
            where: { id: { in: optionIds } },
            include: { group: { select: { id: true, name: true, menuItemId: true } } },
          })
        : [];
      const optionById = new Map(dbOptions.map((o) => [o.id, o]));

      for (const item of incomingItems) {
        const quantity = Number(item?.quantity ?? 1);
        if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) {
          throw new BadRequestException('quantity inválida');
        }
        if (item?.menuItemId) {
          const menuItem = menuById.get(item.menuItemId);
          if (!menuItem) {
            throw new BadRequestException('Producto del menú no válido para este comercio');
          }
          const selectedVariants: Array<{ group: string; option: string; priceDelta: number }> = [];
          let unitPrice = Number(menuItem.price);
          const requested = Array.isArray(item?.variants) ? item.variants : [];
          if (requested.length > 0) {
            const seen = new Set<string>();
            for (const v of requested) {
              const opt: any = optionById.get(v?.optionId);
              if (!opt || opt.group.menuItemId !== menuItem.id) {
                throw new BadRequestException('Variante no válida para este producto');
              }
              if (!opt.isAvailable) {
                throw new BadRequestException(`Variante no disponible: ${opt.name}`);
              }
              if (seen.has(opt.id)) continue;
              seen.add(opt.id);
              const delta = Number(opt.priceDelta);
              unitPrice += delta;
              selectedVariants.push({
                group: opt.group.name,
                option: opt.name,
                priceDelta: Math.round(delta * 100) / 100,
              });
            }
          }
          productsTotal += unitPrice * quantity;
          resolvedItems.push({
            menuItemId: menuItem.id,
            name: menuItem.name,
            price: Math.round(unitPrice * 100) / 100,
            quantity,
            notes: item.notes || undefined,
            selectedVariants,
          });
        } else {
          const name = String(item?.name ?? '').trim();
          if (!name || name.length > 200) {
            throw new BadRequestException('name inválido');
          }
          if (Array.isArray(item?.variants) && item.variants.length > 0) {
            throw new BadRequestException('Los productos personalizados no llevan variantes');
          }
          const price = Number(item?.price ?? 0);
          if (!Number.isFinite(price) || price < 0) {
            throw new BadRequestException('price inválido');
          }
          productsTotal += price * quantity;
          resolvedItems.push({
            menuItemId: null,
            name,
            price,
            quantity,
            notes: item.notes || undefined,
            selectedVariants: [],
          });
        }
      }
    } else {
      productsTotal = Number(data.productsTotal ?? 0);
      if (!Number.isFinite(productsTotal) || productsTotal < 0) {
        throw new BadRequestException('productsTotal inválido');
      }
    }

    // Encomiendas por peso: los primeros 5 kg van incluidos en la tarifa del
    // viaje; cada kg adicional (iniciado) suma ₡500 al viaje (y por ende al
    // payout del repartidor). La comisión de la app sigue siendo el 10%.
    let weightKg: number | null = null;
    if (kind === 'freight' && data.weightKg != null) {
      weightKg = Number(data.weightKg);
      if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) {
        throw new BadRequestException('weightKg inválido (0–500 kg)');
      }
    }
    const weightSurcharge = weightKg ? this.freightWeightSurcharge(weightKg) : 0;

    // Precio por zona (catálogo Nicoya): si el cliente manda deliveryZone
    // válida, esa manda y el servidor pone el precio — el cliente nunca
    // decide el monto. Sin zona, se conserva la lógica anterior por distancia
    // (compatibilidad con clientes viejos y tests).
    let deliveryZone: string | null = null;
    let zoneBase: number | null = null;
    if (data.deliveryZone != null && String(data.deliveryZone).trim() !== '') {
      const zone = findDeliveryZone(data.deliveryZone);
      if (!zone) {
        throw new BadRequestException('Barrio de entrega inválido');
      }
      deliveryZone = zone.id;
      zoneBase = zone.price;
    }

    const tripPrice =
      (zoneBase ??
        this.calculateBasePrice(
          distanceKm,
          { lat: data.pickupLat, lng: data.pickupLng },
          { lat: data.deliveryLat, lng: data.deliveryLng },
        )) + weightSurcharge;
    const commission = Math.round(tripPrice * 0.1) + this.commissionForProducts(productsTotal);
    const driverPayout = tripPrice;
    const totalAmount = productsTotal + tripPrice + commission;
    if (data.packageSize != null && !['S', 'M', 'L'].includes(data.packageSize)) {
      throw new BadRequestException('packageSize inválido');
    }

    const order = await this.prisma.order.create({
      data: {
        merchantId: merchantProfile.id,
        status: orderType === 'scheduled' ? 'driver_proposals' : 'pending',
        orderType,
        scheduledDate,
        scheduledTime: data.scheduledTime,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        deliveryAddress: data.deliveryAddress,
        deliveryLat: data.deliveryLat,
        deliveryLng: data.deliveryLng,
        distanceKm,
        deliveryZone,
        basePrice: tripPrice,
        commission,
        driverPayout,
        totalAmount,
        productsTotal,
        kind,
        packageDescription: data.packageDescription ?? null,
        packageSize: data.packageSize ?? null,
        declaredValue: data.declaredValue ?? null,
        weightKg: weightKg != null ? weightKg : null,
        specialInstructions: data.specialInstructions,
      },
      include: {
        merchant: true,
      },
    });

    // Persist line items so drivers and reports see exactly what to carry.
    // Best-effort: a failure here must not roll back a created order.
    if (resolvedItems.length > 0) {
      try {
        await this.prisma.orderItem.createMany({
          data: resolvedItems.map((item) => ({
            orderId: order.id,
            menuItemId: item.menuItemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            notes: item.notes,
            selectedVariants: item.selectedVariants,
          })),
        });
      } catch (error) {
        console.error('Failed to persist order items:', error);
      }
    }

    // Alerta de pedido nuevo a los drivers con probabilidad real de tomarlo:
    // targeting por proximidad al punto de recojo (socket 1:1 + push 1:1).
    // Forma canónica: los drivers tratan cada item como Order (id + payout).
    // Sin `id`, Aceptar llamaría a /orders/undefined/accept y fallaría siempre.
    if (order.status === 'pending') {
      const payload = {
        id: order.id,
        orderId: order.id,
        pickupAddress: order.pickupAddress,
        deliveryAddress: order.deliveryAddress,
        deliveryZone: (order as any).deliveryZone ?? deliveryZone,
        totalAmount: Number(order.totalAmount),
        driverPayout: order.driverPayout != null ? Number(order.driverPayout) : null,
        distanceKm: Number(order.distanceKm),
        merchantName: merchantProfile.businessName,
        createdAt: order.createdAt,
      };

      void this.alertNearbyDrivers(order, payload);
    }

    return order;
  }

  /**
   * Targeting de la alerta de pedido nuevo: drivers cerca del punto de
   * recojo (socket 1:1 + push 1:1). Sin candidatos ni al radio máximo →
   * fail-open al broadcast por rol (topic FCM + socket role:driver), porque
   * un pedido que nadie ve es peor que una alerta de más.
   *
   * Fire-and-forget: un fallo de notificación NUNCA revierte el pedido.
   */
  private async alertNearbyDrivers(
    order: {
      id: string;
      pickupLat: any;
      pickupLng: any;
      pickupAddress: string;
      deliveryAddress: string;
      totalAmount: any;
      distanceKm: any;
    },
    payload: Record<string, unknown>,
  ) {
    try {
      const pickupLat = order.pickupLat != null ? Number(order.pickupLat) : null;
      const pickupLng = order.pickupLng != null ? Number(order.pickupLng) : null;

      if (pickupLat != null && pickupLng != null) {
        const { candidates, radiusUsedKm, staleSkipped } = await this.proximity.findNearbyDrivers(
          pickupLat,
          pickupLng,
        );

        if (candidates && candidates.length > 0) {
          for (const c of candidates) {
            this.eventsGateway.sendToUser(c.userId, 'order:new', {
              ...payload,
              distanceToPickupKm: Math.round(c.distanceKm * 10) / 10,
            });
            void this.notificationsService
              .notifyDriverNewOrderTargeted(c.userId, {
                id: order.id,
                pickupAddress: order.pickupAddress,
                deliveryAddress: order.deliveryAddress,
                totalAmount: order.totalAmount,
                distanceKm: order.distanceKm,
              })
              .catch(() => undefined);
          }
          this.logger.log(
            `order ${order.id}: targeted alert → ${candidates.length} driver(s) within ${radiusUsedKm}km` +
              (staleSkipped > 0 ? ` (${staleSkipped} skipped by stale location)` : ''),
          );
          return;
        }
        this.logger.warn(
          `order ${order.id}: no drivers within ${radiusUsedKm}km — falling back to broadcast`,
        );
      }

      // Fail-open: sin coords del pickup o sin candidatos.
      this.eventsGateway.sendToRole('driver', 'order:new', payload);
      void this.notificationsService.notifyNewOrderTopic({
        id: order.id,
        pickupAddress: order.pickupAddress,
        deliveryAddress: order.deliveryAddress,
        totalAmount: order.totalAmount,
        distanceKm: order.distanceKm,
      });
    } catch (error) {
      // Última línea de defensa: la alerta jamás tumba la creación.
      this.logger.error(`alertNearbyDrivers(${order.id}) failed: ${String(error)}`);
      try {
        this.eventsGateway.sendToRole('driver', 'order:new', payload);
      } catch {
        // ignore
      }
    }
  }

  async findById(id: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        merchant: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        driver: {
          include: {
            user: {
              select: {
                id: true,
                phone: true,
              },
            },
          },
        },
        payment: true,
        ratings: true,
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    // Check access: merchant owner, assigned driver, or admin
    const isMerchant = order.merchant?.userId === userId;
    const isDriver = order.driver?.userId === userId;

    if (!isMerchant && !isDriver) {
      throw new ForbiddenException('No tienes acceso a este pedido');
    }

    return order;
  }

  /**
   * Order-scoped chat history. Reuses findById for participant-only
   * access: merchant owner, assigned driver, or admin.
   */
  async getOrderMessages(orderId: string, userId: string, limit = 50) {
    await this.findById(orderId, userId);

    const messages = await this.prisma.notification.findMany({
      where: {
        type: 'chat',
        data: { path: ['orderId'], equals: orderId },
        OR: [{ userId }, { data: { path: ['senderId'], equals: userId } }],
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 200),
    });

    return messages.map((m: any) => ({
      id: m.id,
      orderId,
      senderId: m.data?.senderId ?? null,
      senderRole: m.data?.senderRole ?? null,
      text: m.body,
      createdAt: m.createdAt,
      mine: (m.data?.senderId ?? null) === userId,
    }));
  }

  /**
   * Public tracking view (no auth): order IDs are unguessable UUIDs, so the
   * link itself is the credential ("anyone with the link" pattern, same as
   * the public menu). Only share-safe fields are exposed — never phones,
   * emails, amounts or payouts. Driver identity is limited to what the
   * customer needs to recognize the driver (name, photo, vehicle, plate).
   */
  async getPublicTracking(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        merchant: { select: { businessName: true } },
        driver: {
          select: {
            id: true,
            fullName: true,
            photoUrl: true,
            vehicleType: true,
            vehiclePlate: true,
            rating: true,
          },
        },
        items: { select: { name: true, quantity: true, selectedVariants: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    return {
      id: order.id,
      status: order.status,
      orderType: order.orderType,
      pickupAddress: order.pickupAddress,
      pickupLat: order.pickupLat != null ? Number(order.pickupLat) : null,
      pickupLng: order.pickupLng != null ? Number(order.pickupLng) : null,
      deliveryAddress: order.deliveryAddress,
      deliveryLat: order.deliveryLat != null ? Number(order.deliveryLat) : null,
      deliveryLng: order.deliveryLng != null ? Number(order.deliveryLng) : null,
      merchantName: (order as any).merchant?.businessName ?? null,
      driver: order.driverId
        ? {
            fullName: (order as any).driver?.fullName ?? null,
            photoUrl: (order as any).driver?.photoUrl ?? null,
            vehicleType: (order as any).driver?.vehicleType ?? null,
            vehiclePlate: (order as any).driver?.vehiclePlate ?? null,
            rating:
              (order as any).driver?.rating != null ? Number((order as any).driver.rating) : null,
          }
        : null,
      items: ((order as any).items ?? []).map((i: any) => ({
        name: i.name,
        quantity: i.quantity,
        selectedVariants: i.selectedVariants ?? [],
      })),
      createdAt: order.createdAt,
      assignedAt: order.assignedAt,
      pickedUpAt: order.pickedUpAt,
      deliveredAt: order.deliveredAt,
    };
  }

  /**
   * Public driver position for a tracked order (link holders only).
   * No driver identity beyond what getPublicTracking already exposes.
   */
  async getPublicDriverLocation(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order || !order.driverId) {
      throw new NotFoundException('Ubicación no disponible');
    }

    const loc: any = await this.driversService.getLocation(order.driverId);
    return {
      lat: loc.lat,
      lng: loc.lng,
      updatedAt: loc.updatedAt,
      isStale: !!loc.isStale,
      known: loc.known ?? !loc.isStale,
    };
  }

  /**
   * Server-side distance: coords → haversine; else geocode addresses
   * (bounded, best-effort); else the validated client value. The client
   * number is never trusted for pricing when we can measure ourselves.
   */
  private async resolveDistanceKm(
    pickup: { lat: unknown; lng: unknown },
    delivery: { lat: unknown; lng: unknown },
    pickupAddress: string,
    deliveryAddress: string,
    clientKm: number,
  ): Promise<number> {
    const finite = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const pLat = finite(pickup?.lat);
    const pLng = finite(pickup?.lng);
    const dLat = finite(delivery?.lat);
    const dLng = finite(delivery?.lng);

    if (pLat != null && pLng != null && dLat != null && dLng != null) {
      const km = OrdersService.haversineKm(pLat, pLng, dLat, dLng);
      if (Number.isFinite(clientKm) && Math.abs(clientKm - km) > Math.max(1, km * 0.3)) {
        this.logger.warn(
          `distanceKm mismatch: client=${clientKm} server=${km.toFixed(2)} — using server value`,
        );
      }
      return this.boundDistance(km);
    }

    // No coords: try geocoding (4s cap, silent fallback).
    try {
      const [from, to] = await Promise.race([
        Promise.all([
          this.geocodingService.searchCostaRica(pickupAddress, 1),
          this.geocodingService.searchCostaRica(deliveryAddress, 1),
        ]),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ]).then((r) => r ?? [null, null]);
      const a = Array.isArray(from) ? from[0] : null;
      const b = Array.isArray(to) ? to[0] : null;
      if (a && b) {
        return this.boundDistance(OrdersService.haversineKm(a.lat, a.lng, b.lat, b.lng));
      }
    } catch {
      // Fall through to client value.
    }

    if (!Number.isFinite(clientKm) || clientKm < 0) {
      throw new BadRequestException('distanceKm inválido');
    }
    if (clientKm > 300) {
      throw new BadRequestException('distanceKm fuera de rango (máx 300 km)');
    }
    return clientKm;
  }

  private boundDistance(km: number): number {
    if (!Number.isFinite(km) || km < 0) {
      throw new BadRequestException('distanceKm inválido');
    }
    if (km > 600) {
      throw new BadRequestException('distanceKm fuera de rango');
    }
    return Math.round(km * 100) / 100;
  }

  private static readonly VALID_ORDER_STATUSES = [
    'pending',
    'driver_proposals',
    'assigned',
    'in_transit_to_pickup',
    'picked_up',
    'in_transit_to_delivery',
    'delivered',
    'cancelled',
  ] as const;

  private validateOrderStatus(status?: string) {
    if (status && !(OrdersService.VALID_ORDER_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException(`Estado inválido: ${status}`);
    }
  }

  /**
   * Todos los pedidos para el admin: paginado, filtro por estado y búsqueda
   * por id/direcciones/nombres. Incluye stats globales del mismo filtro.
   */
  async listForAdmin(opts: { take?: number; skip?: number; status?: string; search?: string }) {
    if (opts.status) this.validateOrderStatus(opts.status);
    const take = Math.min(Math.max(Number(opts.take ?? 30), 1), 100);
    const skip = Math.max(Number(opts.skip ?? 0), 0);
    const q = (opts.search ?? '').trim();

    const where: any = {};
    if (opts.status) where.status = opts.status;
    if (q) {
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { pickupAddress: { contains: q, mode: 'insensitive' } },
        { deliveryAddress: { contains: q, mode: 'insensitive' } },
        { merchant: { businessName: { contains: q, mode: 'insensitive' } } },
        { driver: { fullName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, items, stats] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          merchant: { select: { businessName: true } },
          driver: { select: { fullName: true } },
          items: { select: { name: true, quantity: true } },
        },
      }),
      this.prisma.order.aggregate({
        where,
        _count: { id: true },
        _sum: { totalAmount: true, commission: true },
      }),
    ]);

    const byStatus = await this.prisma.order.groupBy({
      by: ['status'],
      where: q ? { OR: where.OR } : {},
      _count: { status: true },
    });
    const counts: Record<string, number> = {};
    for (const row of byStatus) counts[row.status] = row._count.status;

    return {
      total,
      items,
      stats: {
        revenue: Number(stats._sum?.totalAmount || 0),
        platformFee: Number(stats._sum?.commission || 0),
        byStatus: counts,
      },
    };
  }

  async findByMerchant(userId: string, status?: string) {
    const merchantProfile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
    });

    if (!merchantProfile) {
      return [];
    }

    this.validateOrderStatus(status);
    const where: any = { merchantId: merchantProfile.id };
    if (status) {
      where.status = status;
    }

    return this.prisma.order.findMany({
      where,
      include: {
        driver: {
          include: {
            user: {
              select: {
                id: true,
                phone: true,
              },
            },
          },
        },
        _count: { select: { proposals: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByDriver(userId: string, status?: string) {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return [];
    }

    this.validateOrderStatus(status);
    const where: any = { driverId: driverProfile.id };
    if (status) {
      where.status = status;
    }

    return this.prisma.order.findMany({
      where,
      include: {
        merchant: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(orderId: string, status: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { merchant: true, driver: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    const isMerchantOwner = order.merchant?.userId === userId;
    const isAssignedDriver = order.driver?.userId === userId;
    if (!isMerchantOwner && !isAssignedDriver) {
      throw new ForbiddenException('No tienes permiso para actualizar este pedido');
    }

    // Validate status transition
    this.validateStatusTransition(order.status, status);

    // Update status with timestamp
    const updateData: any = { status };

    if (status === 'assigned') {
      updateData.assignedAt = new Date();
    } else if (status === 'picked_up') {
      updateData.pickedUpAt = new Date();
    } else if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        merchant: true,
        driver: true,
      },
    });

    // Emit real-time status change to both merchant and driver
    const statusLabels: Record<string, string> = {
      assigned: 'Tu pedido fue asignado a un repartidor',
      in_transit_to_pickup: 'El repartidor va en camino a recoger',
      picked_up: 'El repartidor recogió tu pedido',
      in_transit_to_delivery: 'Tu pedido va en camino',
      delivered: '✅ Tu pedido fue entregado',
      cancelled: 'El pedido fue cancelado',
    };

    const notification = {
      orderId: updatedOrder.id,
      status,
      message: statusLabels[status] || 'Estado actualizado',
      timestamp: new Date(),
    };

    // Create in-app notifications + push 1:1 (copy por estado vive en el
    // servicio de notificaciones).
    if (order.merchant?.userId) {
      this.eventsGateway.sendToUser(order.merchant.userId, 'order:statusChanged', notification);
      await this.notificationsService
        .notifyOrderStatusUpdate(orderId, order.merchant.userId, status)
        .catch(() => null);
    }

    if (order.driver?.userId && status !== 'assigned') {
      this.eventsGateway.sendToUser(order.driver.userId, 'order:statusChanged', notification);
      await this.notificationsService
        .notifyOrderStatusUpdate(orderId, order.driver.userId, status)
        .catch(() => null);
    }

    return updatedOrder;
  }

  async assignDriver(orderId: string, driverId: string, merchantUserId?: string) {
    // Verify driver exists first (no state change yet)
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Repartidor no encontrado');
    }

    // Only active drivers can be assigned: the merchant sees everyone in the
    // directory, but a driver who is offline cannot be chosen — matching what
    // the UI offers.
    if (driverProfile.status !== 'available') {
      throw new BadRequestException(
        `${driverProfile.fullName} no está disponible ahora (estado: ${driverProfile.status}). Podrás asignárselo cuando se conecte.`,
      );
    }
    // KYC gate — desactivado de momento (KYC_REQUIRED != 'true'). El flag
    // reactiva el bloqueo sin cambios de código.
    if (isKycRequired() && driverProfile.kycStatus !== 'approved') {
      throw new BadRequestException(
        `${driverProfile.fullName} aún no está verificado (KYC ${driverProfile.kycStatus}).`,
      );
    }

    // Ownership check: only the merchant that owns the order can assign.
    // Keeps backward compat with existing tests that call without userId.
    if (merchantUserId) {
      const owned = await this.prisma.order.findFirst({
        where: {
          id: orderId,
          merchant: { userId: merchantUserId },
        },
        select: { id: true },
      });
      if (!owned) {
        throw new ForbiddenException('No tienes acceso a este pedido');
      }
    }

    // Atomic claim: only one winner even under concurrency
    const claimed = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        status: { in: ['pending', 'driver_proposals'] },
        driverId: null,
      },
      data: {
        driverId,
        status: 'assigned',
        assignedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!existing) throw new NotFoundException('Pedido no encontrado');
      throw new BadRequestException('El pedido no está disponible');
    }

    const updatedOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { merchant: true, driver: true },
    });

    if (!updatedOrder) throw new NotFoundException('Pedido no encontrado');

    // Notify the assigned driver
    this.eventsGateway.sendToUser(driverProfile.userId, 'order:assigned', {
      orderId: updatedOrder.id,
      pickupAddress: updatedOrder.pickupAddress,
      deliveryAddress: updatedOrder.deliveryAddress,
      totalAmount: Number(updatedOrder.totalAmount),
      message: 'Te asignaron un pedido',
    });

    // Notify merchant
    if (updatedOrder.merchant?.userId) {
      this.eventsGateway.sendToUser(updatedOrder.merchant.userId, 'order:driverAssigned', {
        orderId: updatedOrder.id,
        driverName: driverProfile.fullName,
        message: `${driverProfile.fullName} fue asignado a tu pedido`,
      });
    }

    return updatedOrder;
  }

  async getAvailableOrders(latitude?: number, longitude?: number) {
    return this.prisma.order.findMany({
      where: {
        status: 'pending',
        driverId: null,
      },
      include: {
        merchant: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submitProposal(orderId: string, driverUserId: string, data: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (order.orderType !== 'scheduled') {
      throw new BadRequestException('Solo puedes proponer en pedidos programados');
    }

    if (order.status !== 'driver_proposals') {
      throw new BadRequestException('El pedido ya no acepta propuestas');
    }

    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    const existingProposal = await this.prisma.driverProposal.findFirst({
      where: { orderId, driverId: driverProfile.id },
    });

    if (existingProposal) {
      throw new BadRequestException('Ya enviaste una propuesta para este pedido');
    }

    const proposal = await this.prisma.driverProposal.create({
      data: {
        orderId,
        driverId: driverProfile.id,
        estimatedArrival: data.estimatedArrival,
        message: data.message,
      },
      include: {
        driver: true,
      },
    });

    // Notify merchant about new proposal
    const merchantProfile = await this.prisma.merchantProfile.findUnique({
      where: { id: order.merchantId },
    });

    if (merchantProfile) {
      this.eventsGateway.sendToUser(merchantProfile.userId, 'order:proposalReceived', {
        orderId,
        proposalId: proposal.id,
        driverName: driverProfile.fullName,
        estimatedArrival: data.estimatedArrival,
        message: `${driverProfile.fullName} quiere tomar tu pedido`,
      });
    }

    return proposal;
  }

  async acceptProposal(orderId: string, proposalId: string, merchantUserId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { merchant: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (order.merchant?.userId !== merchantUserId) {
      throw new ForbiddenException('No puedes aceptar propuestas de otros pedidos');
    }

    const proposal = await this.prisma.driverProposal.findUnique({
      where: { id: proposalId },
      include: { driver: true },
    });

    if (!proposal) {
      throw new NotFoundException('Propuesta no encontrada');
    }

    if (proposal.orderId !== orderId) {
      throw new BadRequestException('La propuesta no pertenece a este pedido');
    }

    if (proposal.status !== 'pending') {
      throw new BadRequestException('La propuesta ya fue procesada');
    }

    if (order.status !== 'driver_proposals' && order.status !== 'pending') {
      throw new BadRequestException('El pedido ya no está disponible');
    }

    // Accept proposal and assign driver atomically
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.driverProposal.update({
        where: { id: proposalId },
        data: { status: 'accepted' },
      });

      // Reject other proposals
      await tx.driverProposal.updateMany({
        where: {
          orderId,
          id: { not: proposalId },
        },
        data: { status: 'rejected' },
      });

      // Assign driver to order only if still unassigned
      const claimed = await tx.order.updateMany({
        where: { id: orderId, driverId: null, status: { in: ['pending', 'driver_proposals'] } },
        data: {
          driverId: proposal.driverId,
          status: 'assigned',
          assignedAt: new Date(),
        },
      });

      if (claimed.count === 0) {
        throw new BadRequestException('El pedido ya fue asignado');
      }

      return tx.order.findUnique({
        where: { id: orderId },
        include: { merchant: true, driver: true },
      });
    });

    if (!updatedOrder) throw new NotFoundException('Pedido no encontrado');

    // Notify the winning driver
    this.eventsGateway.sendToUser(proposal.driver.userId, 'order:proposalAccepted', {
      orderId,
      message: 'Tu propuesta fue aceptada. Ve a recoger el pedido.',
    });

    // Notify rejected drivers
    const rejectedProposals = await this.prisma.driverProposal.findMany({
      where: {
        orderId,
        id: { not: proposalId },
        status: 'rejected',
      },
      include: { driver: true },
    });

    for (const rejected of rejectedProposals) {
      this.eventsGateway.sendToUser(rejected.driver.userId, 'order:proposalRejected', {
        orderId,
        message: 'Otra propuesta fue seleccionada para este pedido.',
      });
    }

    return updatedOrder;
  }

  async acceptOrderAsDriver(orderId: string, driverUserId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    // Idempotente: si YA lo tomó este mismo driver (doble tap, popup
    // viejo, reintento), devolverlo en vez de error. Sin esto el tester
    // solo ve "otro repartidor lo tomó" aunque fue él mismo.
    if (
      (order as any).driverId === driverProfile.id &&
      ['assigned', 'in_transit_to_pickup', 'picked_up', 'in_transit_to_delivery'].includes(
        (order as any).status,
      )
    ) {
      return this.prisma.order.findUnique({
        where: { id: orderId },
        include: { merchant: true, driver: true },
      });
    }

    if ((order as any).driverId) {
      throw new BadRequestException('El pedido ya fue tomado por otro repartidor');
    }

    if ((order as any).status === 'driver_proposals' || (order as any).orderType === 'scheduled') {
      throw new BadRequestException(
        'Es un pedido programado: se toma con propuesta, no con Aceptar',
      );
    }

    if ((order as any).status !== 'pending') {
      throw new BadRequestException(
        `El pedido ya no está disponible (estado: ${(order as any).status})`,
      );
    }

    // Atomic claim: only pending orders with no driver can be taken
    const claimed = await this.prisma.order.updateMany({
      where: { id: orderId, status: 'pending', driverId: null },
      data: {
        driverId: driverProfile.id,
        status: 'assigned',
        assignedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      const existing: any = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!existing) throw new NotFoundException('Pedido no encontrado');
      // Carrerita perdida contra vos mismo (doble tap): devolverlo, no error.
      if (existing.driverId === driverProfile.id) {
        return this.prisma.order.findUnique({
          where: { id: orderId },
          include: { merchant: true, driver: true },
        });
      }
      if (existing.driverId) {
        throw new BadRequestException('El pedido ya fue tomado por otro repartidor');
      }
      if (existing.status === 'driver_proposals' || existing.orderType === 'scheduled') {
        throw new BadRequestException(
          'Es un pedido programado: se toma con propuesta, no con Aceptar',
        );
      }
      throw new BadRequestException(`El pedido ya no está disponible (estado: ${existing.status})`);
    }

    // Assign driver
    const updatedOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { merchant: true, driver: true },
    });

    if (!updatedOrder) throw new NotFoundException('Pedido no encontrado');

    // Notify merchant
    if (updatedOrder.merchant?.userId) {
      this.eventsGateway.sendToUser(updatedOrder.merchant.userId, 'order:accepted', {
        orderId: updatedOrder.id,
        driverId: driverProfile.id,
        driverName: driverProfile.fullName,
        vehicleType: driverProfile.vehicleType,
        message: `${driverProfile.fullName} aceptó tu pedido`,
      });

      await this.notificationsService
        .notifyOrderAccepted(updatedOrder.id, updatedOrder.merchant.userId, driverProfile.fullName)
        .catch(() => null);
    }

    // Notify driver confirmation
    this.eventsGateway.sendToUser(driverUserId, 'order:confirmed', {
      orderId: updatedOrder.id,
      message: 'Aceptaste el pedido. Ve a recogerlo.',
    });

    return updatedOrder;
  }

  // Tarifa plana de Nicoya centro: ₡2000 dentro de un radio de 10 km
  // del centro de Nicoya (parque central, aprox. 10.1467, -85.4520).
  private static readonly NICOYA_CENTRO_LAT = 10.1467;
  private static readonly NICOYA_CENTRO_LNG = -85.452;
  private static readonly NICOYA_ZONE_KM = 10;
  private static readonly NICOYA_FLAT_PRICE = 2000;

  private static toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /** Distancia haversine en km entre dos puntos. */
  private static haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = OrdersService.toRadians(lat2 - lat1);
    const dLng = OrdersService.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(OrdersService.toRadians(lat1)) *
        Math.cos(OrdersService.toRadians(lat2)) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  private static isFiniteCoord(value: unknown): value is number {
    const n = Number(value);
    return Number.isFinite(n);
  }

  /** true si el punto está dentro de la zona plana de Nicoya centro. */
  private static isInNicoyaZone(lat: unknown, lng: unknown): boolean {
    if (!OrdersService.isFiniteCoord(lat) || !OrdersService.isFiniteCoord(lng)) return false;
    return (
      OrdersService.haversineKm(
        Number(lat),
        Number(lng),
        OrdersService.NICOYA_CENTRO_LAT,
        OrdersService.NICOYA_CENTRO_LNG,
      ) <= OrdersService.NICOYA_ZONE_KM
    );
  }

  /**
   * Comisión de la app sobre productos: PRODUCT_COMMISSION_PCT (default 15)
   * con tope opcional PRODUCT_COMMISSION_CAP en colones. Redondeo al colón.
   */
  private commissionForProducts(productsTotal: number): number {
    if (productsTotal <= 0) return 0;
    const pct = productCommissionPct();
    let fee = Math.round((productsTotal * pct) / 100);
    const cap = productCommissionCap();
    if (cap != null && fee > cap) fee = Math.round(cap);
    return fee;
  }

  /**
   * Encomiendas por peso: los primeros 5 kg van incluidos en la tarifa base;
   * cada kg adicional (iniciado) suma ₡500 al viaje del repartidor.
   */
  private freightWeightSurcharge(weightKg: number): number {
    if (!Number.isFinite(weightKg) || weightKg <= 0) return 0;
    const extraKg = Math.max(0, Math.ceil(weightKg - 5));
    return extraKg * 500;
  }

  private calculateBasePrice(
    distanceKm: number,
    pickup?: { lat: unknown; lng: unknown },
    delivery?: { lat: unknown; lng: unknown },
  ): number {
    // Zona Nicoya centro: tarifa plana ₡2000. Se evalúa el punto de entrega;
    // si no hay coords de entrega se usa el pickup; sin coords se asume
    // Nicoya (toda la operación) cuando la distancia no supera la zona.
    const hasDeliveryCoords =
      OrdersService.isFiniteCoord(delivery?.lat) && OrdersService.isFiniteCoord(delivery?.lng);
    const hasPickupCoords =
      OrdersService.isFiniteCoord(pickup?.lat) && OrdersService.isFiniteCoord(pickup?.lng);
    const inZone = hasDeliveryCoords
      ? OrdersService.isInNicoyaZone(delivery?.lat, delivery?.lng)
      : hasPickupCoords
        ? OrdersService.isInNicoyaZone(pickup?.lat, pickup?.lng)
        : distanceKm <= OrdersService.NICOYA_ZONE_KM;
    if (inZone) return OrdersService.NICOYA_FLAT_PRICE;

    // Fuera de la zona: tabla por distancia (colonial town, short distances)
    if (distanceKm <= 1) return 800;
    if (distanceKm <= 2) return 1000;
    if (distanceKm <= 5) return 1500;
    if (distanceKm <= 10) return 2000;
    return 2000 + (distanceKm - 10) * 350;
  }

  private validateStatusTransition(current: string, next: string) {
    const validTransitions: Record<string, string[]> = {
      pending: ['assigned', 'cancelled'],
      driver_proposals: ['assigned', 'cancelled'],
      assigned: ['in_transit_to_pickup', 'cancelled'],
      in_transit_to_pickup: ['picked_up', 'cancelled'],
      picked_up: ['in_transit_to_delivery'],
      in_transit_to_delivery: ['delivered'],
      delivered: [],
      cancelled: [],
    };

    if (!validTransitions[current]?.includes(next)) {
      throw new BadRequestException(`No se puede cambiar de ${current} a ${next}`);
    }
  }

  private async createNotification(
    userId: string,
    title: string,
    body: string,
    type: string,
    data?: any,
  ) {
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          title,
          body,
          type,
          data: data || undefined,
        },
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }
}
