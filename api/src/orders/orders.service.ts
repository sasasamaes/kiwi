// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Optional,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { DriversService } from '../drivers/drivers.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProximityService, haversineKm } from './proximity.service';
import { SettingsService } from '../settings/settings.service';
import { findDeliveryZone, findNearestZone, detectDeliveryZoneFromText } from './delivery-zones';
import { parseScheduledCR } from '../common/costa-rica-time';
import { isKycRequired } from '../feature-flags/feature-flags';
import { ImageUploadService } from '../menu/image-upload.service';

/**
 * Lo que un repartidor puede ver del comercio en respuestas de pedidos.
 * `merchant: true` filtraba la fila completa incluyendo creditBalance
 * (saldo prepago interno) a toda la flota. Lista explícita y cerrada.
 */
const MERCHANT_PUBLIC_SELECT = {
  id: true,
  businessName: true,
  address: true,
  latitude: true,
  longitude: true,
  logoUrl: true,
} as const;

/** Lo que se expone del repartidor en respuestas de pedidos. */
const DRIVER_PUBLIC_SELECT = {
  id: true,
  fullName: true,
  photoUrl: true,
  vehicleType: true,
  vehiclePlate: true,
  rating: true,
} as const;

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
    private settingsService: SettingsService,
    @Optional()
    @Inject(ImageUploadService)
    private readonly imageUpload?: ImageUploadService,
  ) {}

  /**
   * Normaliza teléfonos ticos aceptando pegados de WhatsApp: "+506 6380 5455",
   * "50663805455", "6380 5455", "6380-5455" → "6380-5455". Devuelve null si
   * no son 8 dígitos (con o sin código país 506).
   */
  static normalizeCRPhone(raw: unknown): string | null {
    const digits = String(raw ?? '').replace(/[^\d]/g, '');
    const local = digits.length === 11 && digits.startsWith('506') ? digits.slice(3) : digits;
    if (!/^\d{8}$/.test(local)) return null;
    return `${local.slice(0, 4)}-${local.slice(4)}`;
  }

  /**
   * Pedido invitado (link público del menú, sin cuenta): mismo pipeline con
   * precios del servidor que el flujo logueado, atribuido al comercio del
   * link. El id del perfil es público (viaja en la URL del menú); la
   * protección es validación estricta + rate limit, igual que el tracking.
   * El teléfono es obligatorio: sin contacto el comercio no puede resolver
   * entregas. El pickup sale del comercio cuando el cliente no lo manda.
   */
  async createGuestOrder(merchantProfileId: string, data: any) {
    const merchantProfile = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantProfileId },
    });
    if (!merchantProfile) {
      throw new NotFoundException('Comercio no encontrado');
    }

    const phone = OrdersService.normalizeCRPhone(data?.customerPhone ?? '');
    if (!phone) {
      throw new BadRequestException('customerPhone es requerido (formato 8888-8888)');
    }
    if (Array.isArray(data?.items) && data.items.length > 50) {
      throw new BadRequestException('Demasiados items en el pedido (máx 50)');
    }

    // Invitados siempre a concurso: un link público no puede elegir driver.
    const { driverId: _ignored, ...guestData } = data ?? {};
    return this.create(merchantProfile.userId, {
      ...guestData,
      pickupAddress: data?.pickupAddress || merchantProfile.address,
      pickupLat: data?.pickupLat ?? merchantProfile.latitude,
      pickupLng: data?.pickupLng ?? merchantProfile.longitude,
      customerPhone: phone,
    });
  }

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
      // Sin offset se interpreta como hora CR (no UTC del servidor).
      scheduledDate = parseScheduledCR(data.scheduledDate);
      if (!scheduledDate) {
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

    // Sanitizar crudos que se persisten tal cual: un NaN/Infinity/garbage
    // tumba el create con 500 de Prisma en vez de un 400 claro.
    const finiteOrUndef = (v: unknown): number | undefined => {
      if (v == null || v === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    for (const [k, v, min, max] of [
      ['pickupLat', data.pickupLat, -90, 90],
      ['pickupLng', data.pickupLng, -180, 180],
      ['deliveryLat', data.deliveryLat, -90, 90],
      ['deliveryLng', data.deliveryLng, -180, 180],
    ] as const) {
      if (v != null && v !== '') {
        const n = finiteOrUndef(v);
        if (n === undefined || n < min || n > max) {
          throw new BadRequestException(`${k} inválida`);
        }
      }
    }
    if (data.declaredValue != null && data.declaredValue !== '') {
      const dv = Number(data.declaredValue);
      if (!Number.isFinite(dv) || dv < 0) {
        throw new BadRequestException('declaredValue inválido');
      }
    }
    if (data.specialInstructions != null && String(data.specialInstructions).length > 2000) {
      throw new BadRequestException('specialInstructions muy largas (máx 2000)');
    }
    // Contacto del comprador (flujo invitado): se valida y persiste para
    // que el comercio pueda contactar al cliente. Longitudes acotadas.
    if (data.customerName != null && String(data.customerName).length > 120) {
      throw new BadRequestException('customerName muy largo (máx 120)');
    }
    // Acepta pegados de WhatsApp ("+506 6380 5455", "50663805455",
    // "6380 5455") y los guarda canónicos "XXXX-XXXX".
    if (data.customerPhone != null && String(data.customerPhone).trim() !== '') {
      const normalized = OrdersService.normalizeCRPhone(data.customerPhone);
      if (!normalized) {
        throw new BadRequestException('customerPhone inválido (formato 8888-8888)');
      }
      data.customerPhone = normalized;
    }
    if (
      data.scheduledTime != null &&
      data.scheduledTime !== '' &&
      !/^\d{2}:\d{2}$/.test(String(data.scheduledTime))
    ) {
      throw new BadRequestException('scheduledTime inválida (formato HH:MM)');
    }

    // Pricing: el comercio paga productos + viaje, SIN comisión.
    // La comisión (15% fija por viaje) la paga el repartidor: se descuenta
    // de su payout. Kiwi une comercios con repartidores: los productos son
    // 100% del comercio, sin comisión.
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
    // viaje; cada kg adicional (iniciado) suma ₡500 al viaje (y por ende a la
    // base sobre la que se calcula el payout del repartidor).
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

    // Colones enteros: SINPE/efectivo no aceptan fracciones y las sumas
    // (retiros, analytics) arrastrarían decimales. Todo se redondea ANTES
    // de persistir: viaje, productos, comisión y payout derivan enteros.
    productsTotal = Math.round(productsTotal);
    const tripPrice = Math.round(
      (zoneBase ??
        this.calculateBasePrice(
          distanceKm,
          { lat: data.pickupLat, lng: data.pickupLng },
          { lat: data.deliveryLat, lng: data.deliveryLng },
        )) + weightSurcharge,
    );
    // Comisión del repartidor: % configurable por el admin
    // (/admin/settings). El medio de pago (payWithCredit) solo elige cómo
    // paga el comercio, no cambia la tasa. La tasa queda guardada por pedido
    // (commissionRate): cambiar el setting solo afecta pedidos NUEVOS.
    // El servidor pone el monto, el cliente nunca lo decide.
    const commissionPct = await this.settingsService.getDriverCommissionPct();
    const commissionRate = commissionPct / 100;
    const commission = Math.round(tripPrice * commissionRate);
    const driverPayout = tripPrice - commission;
    const totalAmount = productsTotal + tripPrice;
    if (data.packageSize != null && !['S', 'M', 'L'].includes(data.packageSize)) {
      throw new BadRequestException('packageSize inválido');
    }

    // Asignación directa (el comercio eligió a 1 repartidor): se valida
    // ANTES de crear para no publicar un concurso que después se pisa.
    // Si hay driverId válido → el pedido nace asignado y NO se alerta al
    // resto de la flota. Sin driverId → concurso normal (alertNearbyDrivers).
    const requestedDriverId =
      typeof data?.driverId === 'string' && data.driverId.trim() !== ''
        ? data.driverId.trim()
        : null;
    let directDriver: any = null;
    if (requestedDriverId) {
      directDriver = await this.prisma.driverProfile.findUnique({
        where: { id: requestedDriverId },
      });
      if (!directDriver) {
        throw new NotFoundException('Repartidor no encontrado');
      }
      if (directDriver.status !== 'available') {
        throw new BadRequestException(
          `${directDriver.fullName} no está disponible ahora (estado: ${directDriver.status}). Podrás asignárselo cuando se conecte.`,
        );
      }
      if (isKycRequired() && directDriver.kycStatus !== 'approved') {
        throw new BadRequestException(
          `${directDriver.fullName} aún no está verificado (KYC ${directDriver.kycStatus}).`,
        );
      }
    }

    const order = await this.prisma.order.create({
      data: {
        merchantId: merchantProfile.id,
        status: directDriver
          ? 'assigned'
          : orderType === 'scheduled'
            ? 'driver_proposals'
            : 'pending',
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
        commissionRate,
        driverPayout,
        totalAmount,
        productsTotal,
        kind,
        packageDescription: data.packageDescription ?? null,
        packageSize: data.packageSize ?? null,
        declaredValue: data.declaredValue ?? null,
        weightKg: weightKg != null ? weightKg : null,
        specialInstructions: data.specialInstructions,
        customerName: data.customerName != null ? String(data.customerName).trim() || null : null,
        customerPhone:
          data.customerPhone != null ? String(data.customerPhone).trim() || null : null,
        ...(directDriver ? { driverId: directDriver.id, assignedAt: new Date() } : {}),
        // Atómico: los items se crean en la misma escritura. Antes era un
        // createMany best-effort que podía dejar el pedido cobrado sin items
        // (el driver no veía qué llevar).
        ...(resolvedItems.length > 0
          ? {
              items: {
                create: resolvedItems.map((item) => ({
                  menuItemId: item.menuItemId,
                  name: item.name,
                  price: item.price,
                  quantity: item.quantity,
                  notes: item.notes || undefined,
                  selectedVariants: item.selectedVariants,
                })),
              },
            }
          : {}),
      },
      include: {
        merchant: true,
      },
    });

    // Asignación directa: avisar SOLO al elegido (socket 1:1 + push 1:1).
    // Nada de broadcast: el resto de la flota no debe enterarse.
    if (directDriver) {
      const directPayload = {
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
        message: 'Te asignaron un pedido',
      };
      this.eventsGateway.sendToUser(directDriver.userId, 'order:assigned', directPayload);
      void this.notificationsService
        .notifyOrderStatusUpdate(order.id, directDriver.userId, 'assigned', 'driver', {
          shortId: order.id.slice(0, 8).toUpperCase(),
          merchantName: merchantProfile.businessName,
          driverName: directDriver.fullName,
          pickupAddress: order.pickupAddress,
          deliveryAddress: order.deliveryAddress,
          payout: order.driverPayout != null ? Number(order.driverPayout) : undefined,
          totalAmount: Number(order.totalAmount),
          customerName: (order as any).customerName ?? undefined,
        })
        .catch(() => undefined);
      this.eventsGateway.sendToUser(merchantProfile.userId, 'order:driverAssigned', {
        orderId: order.id,
        driverName: directDriver.fullName,
        message: `${directDriver.fullName} fue asignado a tu pedido`,
      });
      return order;
    }

    // Concurso: alerta a los drivers con probabilidad real de tomarlo
    // (targeting por proximidad al punto de recojo, socket 1:1 + push 1:1).
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
    } else if (order.status === 'driver_proposals') {
      // Programados: antes nadie se enteraba (sin alerta la página de
      // programados solo se llenaba con refresh manual). Evento propio para
      // no mezclarlos con los inmediatos de Disponibles.
      const payload = {
        id: order.id,
        orderId: order.id,
        orderType: 'scheduled',
        scheduledDate: order.scheduledDate,
        scheduledTime: (order as any).scheduledTime ?? null,
        pickupAddress: order.pickupAddress,
        deliveryAddress: order.deliveryAddress,
        deliveryZone: (order as any).deliveryZone ?? deliveryZone,
        totalAmount: Number(order.totalAmount),
        driverPayout: order.driverPayout != null ? Number(order.driverPayout) : null,
        distanceKm: Number(order.distanceKm),
        merchantName: merchantProfile.businessName,
        createdAt: order.createdAt,
      };

      void this.alertNearbyDrivers(order, payload, 'order:scheduledNew');
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
  async alertNearbyDrivers(
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
    event: 'order:new' | 'order:scheduledNew' = 'order:new',
  ) {
    const scheduled = event === 'order:scheduledNew';
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
            this.eventsGateway.sendToUser(c.userId, event, {
              ...payload,
              distanceToPickupKm: Math.round(c.distanceKm * 10) / 10,
            });
            const target = {
              id: order.id,
              pickupAddress: order.pickupAddress,
              deliveryAddress: order.deliveryAddress,
              totalAmount: order.totalAmount,
              driverPayout: (order as any).driverPayout,
              distanceKm: order.distanceKm,
              scheduledTime: (order as any).scheduledTime ?? null,
            };
            void (
              scheduled
                ? this.notificationsService.notifyDriverScheduledOrderTargeted(c.userId, target)
                : this.notificationsService.notifyDriverNewOrderTargeted(c.userId, target)
            ).catch(() => undefined);
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
      this.eventsGateway.sendToRole('driver', event, payload);
      const topicOrder = {
        id: order.id,
        pickupAddress: order.pickupAddress,
        deliveryAddress: order.deliveryAddress,
        totalAmount: order.totalAmount,
        driverPayout: (order as any).driverPayout,
        distanceKm: order.distanceKm,
        scheduledTime: (order as any).scheduledTime ?? null,
      };
      void (
        scheduled
          ? this.notificationsService.notifyScheduledOrderTopic(topicOrder)
          : this.notificationsService.notifyNewOrderTopic(topicOrder)
      ).catch(() => undefined);
    } catch (error) {
      // Última línea de defensa: la alerta jamás tumba la creación.
      this.logger.error(`alertNearbyDrivers(${order.id}) failed: ${String(error)}`);
      try {
        this.eventsGateway.sendToRole('driver', event, payload);
      } catch {
        // ignore
      }
    }
  }

  async findById(id: string, userId: string, role?: string) {
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

    if (!isMerchant && !isDriver && role !== 'admin') {
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
      // UUID necesario para pedir la ubicación (con guarda por rol en el
      // endpoint logueado). Sin esto, los logueados nunca veían el punto azul.
      driverId: order.driverId ?? null,
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
      acceptanceExpiresAt: (order as any).acceptanceExpiresAt ?? null,
      contestStartedAt: (order as any).contestStartedAt ?? null,
      contestEndsAt: (order as any).contestEndsAt ?? null,
      pickedUpAt: order.pickedUpAt,
      deliveredAt: order.deliveredAt,
      // Evidencia fotográfica 1+1: prueba ante reclamos, visible con el link.
      pickupProofPhotoUrl: (order as any).pickupProofPhotoUrl ?? null,
      pickupProofAt: (order as any).pickupProofAt ?? null,
      deliveryProofPhotoUrl: (order as any).deliveryProofPhotoUrl ?? null,
      deliveryProofAt: (order as any).deliveryProofAt ?? null,
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
    // Sin fix conocido (o rancio): 404 en vez de plotear el centro de Nicoya
    // como si fuera el repartidor.
    if (!loc || loc.known !== true) {
      throw new NotFoundException('Ubicación no disponible');
    }
    return {
      lat: loc.lat,
      lng: loc.lng,
      updatedAt: loc.updatedAt,
      isStale: !!loc.isStale,
      known: true,
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
    'pending_acceptance',
    'in_transit_to_pickup',
    'picked_up',
    'in_transit_to_delivery',
    'delivered',
    'cancelled',
    'no_driver',
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

  /**
   * Mezcla real de zonas de los pedidos ENTREGADOS: distribución por zona del
   * catálogo Nicoya (para el simulador de ganancias del admin).
   *
   * Fuente por pedido, en orden de precisión:
   *  1. deliveryZone fija en el pedido (el pricing del servidor la validó).
   *  2. Zona más cercana por GPS de entrega (findNearestZone); se descarta si
   *     el gap con la 2ª zona es ambiguo (confident=false).
   *  3. Detección por texto de la dirección (detectDeliveryZoneFromText).
   * Lo que no clasifica queda en `unclassified` y NO entra a los pesos.
   */
  async getDeliveredZoneMix() {
    const delivered = await this.prisma.order.findMany({
      where: { status: 'delivered' },
      select: {
        deliveryZone: true,
        deliveryAddress: true,
        deliveryLat: true,
        deliveryLng: true,
      },
    });

    const counts: Record<string, number> = {};
    let unclassified = 0;
    for (const o of delivered) {
      let zoneId: string | null = null;
      if (o.deliveryZone) {
        zoneId = findDeliveryZone(o.deliveryZone)?.id ?? null;
      }
      if (!zoneId && o.deliveryLat != null && o.deliveryLng != null) {
        const near = findNearestZone(o.deliveryLat, o.deliveryLng);
        if (near?.confident) zoneId = near.zone.id;
      }
      if (!zoneId) {
        zoneId = detectDeliveryZoneFromText(o.deliveryAddress)?.id ?? null;
      }
      if (zoneId) counts[zoneId] = (counts[zoneId] ?? 0) + 1;
      else unclassified += 1;
    }

    const classified = delivered.length - unclassified;
    const weights: Record<string, number> = {};
    if (classified > 0) {
      // Peso entero % por zona; el residuo de redondeo se lo lleva la zona
      // mayor para que la suma sea exactamente 100 (lo que espera la UI).
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      let assigned = 0;
      for (const [id, n] of entries.slice(1)) {
        weights[id] = Math.round((n / classified) * 100);
        assigned += weights[id];
      }
      weights[entries[0][0]] = 100 - assigned;
    }

    return {
      delivered: delivered.length,
      classified,
      unclassified,
      // Zonas con conteo y peso % (detalle para la UI).
      zones: Object.entries(counts)
        .map(([id, count]) => ({
          id,
          count,
          weight: Math.round((count / (classified || 1)) * 100),
        }))
        .sort((a, b) => b.count - a.count),
      weights,
    };
  }

  /**
   * Ingresos REALES por mes para el reporte "Real vs Proyección" del admin.
   * Usa los montos históricos guardados en cada pedido entregado: deliveryFee
   * (precio del viaje, GMV logístico), commission y commissionRate (lo cobrado
   * al repartidor, con el % vigente al momento del pedido).
   *
   * `months` = 3 devuelve los últimos 3 meses incluyendo el mes en curso
   * (más antiguo primero) para la tendencia.
   *
   * Además devuelve `last30`: ventana móvil de los últimos 30 días naturales
   * (viajes, GMV, comisión y ritmo diario) para ajustar el escenario del
   * simulador al rendimiento real.
   */
  async getMonthlyActuals(months = 6) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const start30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const orders = await this.prisma.order.findMany({
      where: { status: 'delivered', deliveredAt: { gte: start, lt: end } },
      select: {
        deliveredAt: true,
        deliveryZone: true,
        basePrice: true,
        commission: true,
        commissionRate: true,
      },
    });

    const buckets = new Map<
      string,
      {
        trips: number;
        gmv: number;
        commission: number;
        rates: number[];
        zones: Record<string, number>;
      }
    >();
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    for (let i = 0; i < months; i += 1) {
      buckets.set(key(new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1)), {
        trips: 0,
        gmv: 0,
        commission: 0,
        rates: [],
        zones: {},
      });
    }

    for (const o of orders) {
      if (!o.deliveredAt) continue;
      const b = buckets.get(key(o.deliveredAt));
      if (!b) continue;
      const fee = Number(o.basePrice ?? 0);
      const comm = Number(o.commission ?? 0);
      b.trips += 1;
      b.gmv += fee;
      b.commission += comm;
      if (o.commissionRate != null) b.rates.push(Number(o.commissionRate));
      if (o.deliveryZone) b.zones[o.deliveryZone] = (b.zones[o.deliveryZone] ?? 0) + 1;
    }

    const monthly = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, b]) => ({
        month,
        trips: b.trips,
        gmv: Math.round(b.gmv),
        commission: Math.round(b.commission),
        avgCommissionRate: b.rates.length
          ? b.rates.reduce((s, r) => s + r, 0) / b.rates.length
          : null,
        tripsByZone: Object.fromEntries(Object.entries(b.zones).sort((a, c) => c[1] - a[1])),
      }));

    // Ventana móvil de los últimos 30 días (independiente del corte de mes).
    let last30 = { trips: 0, gmv: 0, commission: 0 };
    for (const o of orders) {
      if (!o.deliveredAt) continue;
      if (o.deliveredAt >= start30) {
        last30.trips += 1;
        last30.gmv += Number(o.basePrice ?? 0);
        last30.commission += Number(o.commission ?? 0);
      }
    }
    last30 = {
      trips: last30.trips,
      gmv: Math.round(last30.gmv),
      commission: Math.round(last30.commission),
    };

    return {
      months,
      monthly,
      last30: {
        ...last30,
        tripsPerDay: last30.trips / 30,
        commissionPerDay: last30.commission / 30,
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
        items: { select: { name: true, quantity: true } },
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
        // El asignado necesita llamar al comercio si se pierde yendo al
        // pickup. Solo ve este teléfono el driver del pedido (la vitrina de
        // disponibles lo sigue ocultando a la flota).
        merchant: { select: { ...MERCHANT_PUBLIC_SELECT, user: { select: { phone: true } } } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Registra la foto de evidencia del pedido (URLs del Task 1 + timestamps).
   * - `pickup`: solo el comercio dueño sube la foto de entrega al repartidor.
   * - `delivery`: solo el repartidor asignado sube la foto de entrega al cliente.
   * - Congeladas al avanzar: re-subir la pickup ya recogido (o la delivery ya
   *   entregado) invalidaría la prueba ante reclamos.
   */
  async uploadProofPhoto(
    orderId: string,
    kind: 'pickup' | 'delivery',
    url: string,
    userId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { merchant: true, driver: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    const isMerchantOwner = order.merchant?.userId === userId;
    const isAssignedDriver = order.driver?.userId === userId;
    if (kind === 'pickup' && !isMerchantOwner)
      throw new ForbiddenException('Solo el comercio sube la foto de entrega al repartidor');
    if (kind === 'delivery' && !isAssignedDriver)
      throw new ForbiddenException(
        'Solo el repartidor asignado sube la foto de entrega al cliente',
      );
    const PICKUP_FROZEN = ['picked_up', 'in_transit_to_delivery', 'delivered'];
    const DELIVERY_FROZEN = ['delivered'];
    if (kind === 'pickup' && PICKUP_FROZEN.includes((order as any).status)) {
      throw new BadRequestException(
        'El pedido ya fue recogido: la foto de entrega al repartidor quedó registrada.',
      );
    }
    if (kind === 'delivery' && DELIVERY_FROZEN.includes((order as any).status)) {
      throw new BadRequestException(
        'El pedido ya fue entregado: la foto de entrega al cliente quedó registrada.',
      );
    }
    const data: any =
      kind === 'pickup'
        ? { pickupProofPhotoUrl: url, pickupProofAt: new Date() }
        : { deliveryProofPhotoUrl: url, deliveryProofAt: new Date() };
    return this.prisma.order.update({ where: { id: orderId }, data });
  }

  /**
   * Valida `kind`, sube el binario vía `imageUpload.uploadProofImage(file)`
   * y registra la URL con `uploadProofPhoto`.
   */
  async uploadProofPhotoWithFile(
    orderId: string,
    kind: 'pickup' | 'delivery',
    file: any,
    userId: string,
  ) {
    if (kind !== 'pickup' && kind !== 'delivery') {
      throw new BadRequestException('kind inválido: usá pickup o delivery');
    }
    if (!file) {
      throw new BadRequestException('Foto requerida (multipart `photo`)');
    }
    if (!this.imageUpload) {
      throw new BadRequestException('Subida de imágenes no disponible');
    }
    const { url } = await this.imageUpload.uploadProofImage(file);
    return this.uploadProofPhoto(orderId, kind, url, userId);
  }

  async updateStatus(
    orderId: string,
    status: string,
    userId: string,
    role?: string,
    proofPhotoUrl?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { merchant: true, driver: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    const isMerchantOwner = order.merchant?.userId === userId;
    const isAssignedDriver = order.driver?.userId === userId;
    if (!isMerchantOwner && !isAssignedDriver && role !== 'admin') {
      throw new ForbiddenException('No tienes permiso para actualizar este pedido');
    }

    // Validate status transition
    this.validateStatusTransition(order.status, status);
    // Cada actor solo mueve sus propios estados: el comercio no puede
    // pilotear el ciclo hasta entregado, ni el driver cancelar a mitad
    // de ruta (eso es abandono/rechazo por su propio endpoint).
    this.validateStatusActor(order.status, status, {
      isMerchantOwner,
      isAssignedDriver,
      role,
    });

    // Evidencia fotográfica 1+1 obligatoria para avanzar.
    if (status === 'picked_up' && !(order as any).pickupProofPhotoUrl) {
      throw new BadRequestException(
        'Subí la foto de evidencia para continuar: el comercio debe fotografiar el pedido al entregarlo.',
      );
    }
    if (status === 'delivered' && !(order as any).deliveryProofPhotoUrl) {
      throw new BadRequestException(
        'Subí la foto de evidencia para continuar: fotografiá la entrega al cliente.',
      );
    }

    // Update status with timestamp
    const updateData: any = { status };

    // Atajo opcional: el cliente puede mandar la URL ya subida junto al
    // cambio de estado (el flujo principal es POST :id/proof-photo).
    if (proofPhotoUrl && status === 'picked_up' && !(order as any).pickupProofPhotoUrl) {
      updateData.pickupProofPhotoUrl = proofPhotoUrl;
      updateData.pickupProofAt = new Date();
      (order as any).pickupProofPhotoUrl = proofPhotoUrl;
    }
    if (proofPhotoUrl && status === 'delivered' && !(order as any).deliveryProofPhotoUrl) {
      updateData.deliveryProofPhotoUrl = proofPhotoUrl;
      updateData.deliveryProofAt = new Date();
      (order as any).deliveryProofPhotoUrl = proofPhotoUrl;
    }

    if (status === 'assigned') {
      updateData.assignedAt = new Date();
    } else if (status === 'picked_up') {
      updateData.pickedUpAt = new Date();
    } else if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    } else if (order.status === 'no_driver' && status === 'pending') {
      // Reintento del comercio: reabre el concurso con ventana fresca para que
      // el sweeper no lo marque no_driver de inmediato y la flota lo vea.
      let contestMinutes = 10;
      try {
        const t = await (this.settingsService as any).getAssignmentTimeouts?.();
        if (t && Number.isFinite(Number(t.contestMinutes))) {
          contestMinutes = t.contestMinutes;
        }
      } catch {
        // default admin (10); jamás bloquea el reintento.
      }
      const now = new Date();
      updateData.driverId = null;
      updateData.contestStartedAt = now;
      updateData.contestEndsAt = new Date(now.getTime() + contestMinutes * 60_000);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        merchant: { select: MERCHANT_PUBLIC_SELECT },
        driver: { select: DRIVER_PUBLIC_SELECT },
      },
    });

    // Reintento: el pedido volvió a concurso, re-alertar a la flota
    // (proximidad + fail-open a broadcast). Sin esto quedaba en pending
    // invisible. Best-effort: jamás tumba el cambio de estado.
    if (order.status === 'no_driver' && status === 'pending') {
      void this.alertNearbyDrivers(updatedOrder as any, {
        id: updatedOrder.id,
        orderId: updatedOrder.id,
        pickupAddress: (updatedOrder as any).pickupAddress,
        deliveryAddress: (updatedOrder as any).deliveryAddress,
        deliveryZone: (updatedOrder as any).deliveryZone ?? null,
        totalAmount: Number((updatedOrder as any).totalAmount),
        driverPayout:
          (updatedOrder as any).driverPayout != null
            ? Number((updatedOrder as any).driverPayout)
            : null,
        distanceKm: Number((updatedOrder as any).distanceKm),
        merchantName: (updatedOrder as any).merchant?.businessName,
        createdAt: (updatedOrder as any).createdAt,
      }).catch(() => undefined);
    }

    // Contador de viajes del repartidor: solo al entregar (la transición
    // validada impide doble conteo por API). Best-effort: jamás tumba la
    // entrega si falla.
    if (status === 'delivered' && updatedOrder.driverId) {
      await this.prisma.driverProfile
        .update({
          where: { id: updatedOrder.driverId },
          data: { totalTrips: { increment: 1 } },
        })
        .catch((e) => this.logger.error(`totalTrips increment failed: ${String(e)}`));
    }

    // Emit real-time status change to both merchant and driver.
    // Cada rol recibe SU copia: el comercio lee "tu pedido", el repartidor
    // lee su acción ("recogiste", "entregaste"). Un mensaje único con la
    // perspectiva del comercio en el inbox del driver se lee como una
    // notificación ajena. Cada paso lleva #pedido y nombres para que los
    // mensajes no sean todos iguales.
    const shortId = orderId.slice(0, 8).toUpperCase();
    const merchantName =
      (updatedOrder as any).merchant?.businessName ?? order.merchant?.businessName ?? 'el comercio';
    const driverName =
      (updatedOrder as any).driver?.fullName ?? order.driver?.fullName ?? 'El repartidor';
    const statusContext = {
      shortId,
      merchantName,
      driverName,
      pickupAddress: (updatedOrder as any).pickupAddress ?? order.pickupAddress,
      deliveryAddress: (updatedOrder as any).deliveryAddress ?? order.deliveryAddress,
      payout:
        (updatedOrder as any).driverPayout != null
          ? Number((updatedOrder as any).driverPayout)
          : order.driverPayout != null
            ? Number(order.driverPayout)
            : undefined,
      totalAmount: Number((updatedOrder as any).totalAmount ?? order.totalAmount),
      customerName: (updatedOrder as any).customerName ?? order.customerName ?? undefined,
    };
    const merchantLabels: Record<string, string> = {
      assigned: `#${shortId}: ${driverName} fue asignado a tu pedido`,
      pending_acceptance: `#${shortId}: esperando aceptación del repartidor`,
      no_driver: `#${shortId}: sin repartidores disponibles`,
      in_transit_to_pickup: `#${shortId}: ${driverName} va en camino a recoger`,
      picked_up: `#${shortId}: ${driverName} recogió tu pedido`,
      in_transit_to_delivery: `#${shortId}: tu pedido va en camino a ${statusContext.deliveryAddress || 'su destino'}`,
      delivered: `#${shortId}: ✅ tu pedido fue entregado`,
      cancelled: `#${shortId}: el pedido fue cancelado`,
    };
    const driverLabels: Record<string, string> = {
      assigned: `#${shortId}: te asignaron el pedido de ${merchantName}. Ve a recogerlo`,
      pending_acceptance: `#${shortId}: tenés un pedido pendiente de aceptación`,
      no_driver: `#${shortId}: sin repartidores disponibles`,
      in_transit_to_pickup: `#${shortId}: vas en camino a recoger en ${statusContext.pickupAddress || merchantName}`,
      picked_up: `#${shortId}: recogiste el pedido. Llevalo a ${statusContext.deliveryAddress || 'su destino'}`,
      in_transit_to_delivery: `#${shortId}: vas en camino a entregar en ${statusContext.deliveryAddress || 'su destino'}`,
      delivered: `#${shortId}: ✅ entregaste el pedido`,
      cancelled: `#${shortId}: el pedido fue cancelado`,
    };

    const baseNotification = {
      orderId: updatedOrder.id,
      status,
      timestamp: new Date(),
    };

    // Create in-app notifications + push 1:1 (copy por estado vive en el
    // servicio de notificaciones). Fire-and-forget: el estado ya está
    // persistido; esperar a FCM infla el p99 del PUT sin beneficio.
    if (order.merchant?.userId) {
      this.eventsGateway.sendToUser(order.merchant.userId, 'order:statusChanged', {
        ...baseNotification,
        message: merchantLabels[status] || 'Estado actualizado',
      });
      void this.notificationsService
        .notifyOrderStatusUpdate(orderId, order.merchant.userId, status, 'merchant', statusContext)
        .catch(() => undefined);
    }

    if (order.driver?.userId && status !== 'assigned') {
      this.eventsGateway.sendToUser(order.driver.userId, 'order:statusChanged', {
        ...baseNotification,
        message: driverLabels[status] || 'Estado actualizado',
      });
      void this.notificationsService
        .notifyOrderStatusUpdate(orderId, order.driver.userId, status, 'driver', statusContext)
        .catch(() => undefined);
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

    const target = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { orderType: true },
    });
    let acceptanceMinutes = 5;
    try {
      const t = await (this.settingsService as any).getAssignmentTimeouts?.();
      if (t && Number.isFinite(Number(t.acceptanceMinutes))) {
        acceptanceMinutes = t.acceptanceMinutes;
      }
    } catch {
      // defaults admin (5) si settings no responde; jamás bloquea asignar.
    }
    const isScheduled = target?.orderType === 'scheduled';

    // Atomic claim: only one winner even under concurrency
    const claimed = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        status: { in: ['pending', 'driver_proposals'] },
        driverId: null,
      },
      data: isScheduled
        ? {
            driverId,
            status: 'assigned',
            assignedAt: new Date(),
          }
        : {
            driverId,
            status: 'pending_acceptance',
            assignedAt: new Date(),
            acceptanceExpiresAt: new Date(Date.now() + acceptanceMinutes * 60_000),
            contestStartedAt: null,
            contestEndsAt: null,
          },
    });

    if (claimed.count === 0) {
      const existing: any = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { driver: { select: { fullName: true } } },
      });
      if (!existing) throw new NotFoundException('Pedido no encontrado');
      if (existing.driverId) {
        const winner = existing.driver?.fullName ?? 'Otro repartidor';
        throw new BadRequestException(`${winner} ya tomó este pedido`);
      }
      throw new BadRequestException(`El pedido ya no está disponible (estado: ${existing.status})`);
    }

    const updatedOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { merchant: true, driver: true },
    });

    if (!updatedOrder) throw new NotFoundException('Pedido no encontrado');

    if (!isScheduled) {
      try {
        await (this.prisma as any).orderEvent?.create?.({
          data: { orderId, type: 'assigned', actorId: merchantUserId ?? null, driverId },
        });
      } catch {
        // auditoría best-effort: jamás bloquea la asignación.
      }
      this.eventsGateway.sendToUser(driverProfile.userId, 'order:assignmentOffered', {
        orderId,
        message: `Tenés un pedido pendiente de aceptación (${acceptanceMinutes} min para aceptar)`,
      });
      void this.notificationsService
        .notifyAssignmentOffered(orderId, driverProfile.userId, acceptanceMinutes)
        .catch(() => undefined);
    }

    // Notify the assigned driver
    this.eventsGateway.sendToUser(driverProfile.userId, 'order:assigned', {
      id: updatedOrder.id,
      orderId: updatedOrder.id,
      pickupAddress: updatedOrder.pickupAddress,
      deliveryAddress: updatedOrder.deliveryAddress,
      totalAmount: Number(updatedOrder.totalAmount),
      driverPayout:
        (updatedOrder as any).driverPayout != null
          ? Number((updatedOrder as any).driverPayout)
          : null,
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

    // Sacar el pedido de los Disponibles del resto: el primero que lo toma
    // lo saca del concurso para todos (los perdedores lo ven desaparecer en
    // vivo sin tener que reintentar Aceptar).
    this.eventsGateway.sendToRole('driver', 'order:taken', {
      id: updatedOrder.id,
      orderId: updatedOrder.id,
      status: (updatedOrder as any).status ?? 'assigned',
      driverName: driverProfile.fullName,
      message: `${driverProfile.fullName} ya tomó este pedido`,
    });

    return updatedOrder;
  }

  /** El driver asignado acepta dentro del plazo: pending_acceptance → assigned. */
  async acceptAssignment(orderId: string, driverUserId: string) {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });
    if (!driverProfile) throw new NotFoundException('Perfil de repartidor no encontrado');
    const claimed = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        driverId: driverProfile.id,
        status: 'pending_acceptance',
        acceptanceExpiresAt: { gt: new Date() },
      },
      data: { status: 'assigned', acceptanceExpiresAt: null },
    });
    if (claimed.count === 0) {
      const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!existing) throw new NotFoundException('Pedido no encontrado');
      throw new BadRequestException('El pedido ya no está pendiente de tu aceptación');
    }
    try {
      await (this.prisma as any).orderEvent?.create?.({
        data: { orderId, type: 'accepted', driverId: driverProfile.id },
      });
    } catch {
      // auditoría best-effort.
    }
    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { merchant: true, driver: true },
    });
    if (updated?.merchant?.userId) {
      this.eventsGateway.sendToUser(updated.merchant.userId, 'order:accepted', {
        orderId,
        driverName: driverProfile.fullName,
        message: `${driverProfile.fullName} aceptó tu pedido`,
      });
    }
    return updated;
  }

  async getAvailableOrders(latitude?: number, longitude?: number, opts?: { scheduled?: boolean }) {
    // Programados: el concurso vive en driver_proposals. Sin este filtro la
    // página de programados del driver pedía ?scheduled=true y recibía los
    // inmediatos (el controlador ignoraba el flag).
    const scheduledOnly = opts?.scheduled === true;
    const orders = await this.prisma.order.findMany({
      where: scheduledOnly
        ? {
            status: 'driver_proposals',
            orderType: 'scheduled',
            driverId: null,
          }
        : {
            status: 'pending',
            driverId: null,
          },
      include: {
        merchant: { select: MERCHANT_PUBLIC_SELECT },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    // Con ubicación del driver: primero lo cercano (haversine al pickup;
    // sin coords del comercio van al final, no se esconden). Sin ubicación:
    // lo más reciente, como antes.
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const distOf = (o: any): number => {
        const mLat = Number(o?.merchant?.latitude);
        const mLng = Number(o?.merchant?.longitude);
        if (!Number.isFinite(mLat) || !Number.isFinite(mLng)) return Number.POSITIVE_INFINITY;
        return haversineKm(lat, lng, mLat, mLng);
      };
      orders.sort((a: any, b: any) => distOf(a) - distOf(b));
    }
    // El contacto del comprador solo lo ve el repartidor ASIGNADO (o el
    // comercio): en la vitrina de disponibles se oculta a la flota.
    return orders.map(({ customerName, customerPhone, ...rest }: any) => rest);
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
    const order: any = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { driver: { select: { fullName: true } } },
    });
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
      const winner = (order as any).driver?.fullName;
      throw new BadRequestException(
        winner ? `${winner} ya tomó este pedido` : 'El pedido ya fue tomado por otro repartidor',
      );
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
      where: {
        id: orderId,
        status: 'pending',
        driverId: null,
        OR: [{ contestEndsAt: null }, { contestEndsAt: { gte: new Date() } }],
      },
      data: {
        driverId: driverProfile.id,
        status: 'assigned',
        assignedAt: new Date(),
        contestStartedAt: null,
        contestEndsAt: null,
      },
    });

    if (claimed.count === 0) {
      const existing: any = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { driver: { select: { fullName: true } } },
      });
      if (!existing) throw new NotFoundException('Pedido no encontrado');
      // Carrerita perdida contra vos mismo (doble tap): devolverlo, no error.
      if (existing.driverId === driverProfile.id) {
        return this.prisma.order.findUnique({
          where: { id: orderId },
          include: { merchant: true, driver: true },
        });
      }
      if (existing.driverId) {
        const winner = existing.driver?.fullName;
        throw new BadRequestException(
          winner ? `${winner} ya tomó este pedido` : 'El pedido ya fue tomado por otro repartidor',
        );
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

    try {
      await (this.prisma as any).orderEvent?.create?.({
        data: { orderId, type: 'accepted', driverId: driverProfile.id },
      });
    } catch {
      // auditoría best-effort.
    }

    // Notify merchant (push fire-and-forget: el socket ya avisa en vivo).
    if (updatedOrder.merchant?.userId) {
      this.eventsGateway.sendToUser(updatedOrder.merchant.userId, 'order:accepted', {
        orderId: updatedOrder.id,
        driverId: driverProfile.id,
        driverName: driverProfile.fullName,
        vehicleType: driverProfile.vehicleType,
        message: `${driverProfile.fullName} aceptó tu pedido`,
      });

      void this.notificationsService
        .notifyOrderAccepted(updatedOrder.id, updatedOrder.merchant.userId, driverProfile.fullName)
        .catch(() => undefined);
    }

    // Notify driver confirmation
    this.eventsGateway.sendToUser(driverUserId, 'order:confirmed', {
      orderId: updatedOrder.id,
      message: 'Aceptaste el pedido. Ve a recogerlo.',
    });

    // El primero que lo acepta lo toma: avisar al resto de la flota para que
    // lo saque de Disponibles en vivo (sin esperar refetch ni reintento).
    this.eventsGateway.sendToRole('driver', 'order:taken', {
      id: updatedOrder.id,
      orderId: updatedOrder.id,
      status: 'assigned',
      driverName: driverProfile.fullName,
      message: `${driverProfile.fullName} ya tomó este pedido`,
    });

    return updatedOrder;
  }

  /**
   * El repartidor asignado rechaza el pedido ANTES de recoger: vuelve a
   * pendiente (concurso) y se avisa al comercio para que reasigne.
   * Atómico: solo el asignado y solo en assigned/in_transit_to_pickup/pending_acceptance.
   * Después de recoger ya no se puede rechazar (hay que entregar).
   */
  async rejectOrderAsDriver(orderId: string, driverUserId: string) {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });
    if (!driverProfile) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    let claimed = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        driverId: driverProfile.id,
        status: { in: ['assigned', 'in_transit_to_pickup'] },
      },
      data: { driverId: null, status: 'pending', assignedAt: null },
    });
    if (claimed.count === 0) {
      claimed = await this.prisma.order.updateMany({
        where: {
          id: orderId,
          driverId: driverProfile.id,
          status: { in: ['pending_acceptance'] },
        },
        data: { driverId: null, status: 'pending', assignedAt: null, acceptanceExpiresAt: null },
      });
    }
    if (claimed.count === 0) {
      const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!existing) throw new NotFoundException('Pedido no encontrado');
      throw new BadRequestException(
        'Solo podés rechazar un pedido asignado a vos antes de recoger',
      );
    }

    let contestMinutes = 10;
    try {
      const t = await (this.settingsService as any).getAssignmentTimeouts?.();
      if (t && Number.isFinite(Number(t.contestMinutes))) {
        contestMinutes = t.contestMinutes;
      }
    } catch {
      // default admin (10); jamás bloquea el rechazo.
    }
    try {
      await (this.prisma.order as any).update?.({
        where: { id: orderId },
        data: {
          driverId: null,
          status: 'pending',
          assignedAt: null,
          acceptanceExpiresAt: null,
          contestStartedAt: new Date(),
          contestEndsAt: new Date(Date.now() + contestMinutes * 60_000),
        },
      });
    } catch {
      // concurso best-effort en mocks sin update.
    }
    try {
      await (this.prisma as any).orderEvent?.create?.({
        data: { orderId, type: 'rejected', driverId: driverProfile.id },
      });
    } catch {
      // auditoría best-effort.
    }
    try {
      await (this.prisma as any).orderEvent?.create?.({
        data: { orderId, type: 'contest_started', meta: { reason: 'rejected' } },
      });
    } catch {
      // auditoría best-effort.
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { merchant: true },
    });

    // Avisar al comercio por las dos vías: socket en vivo + push/inbox.
    if (order?.merchant?.userId) {
      this.eventsGateway.sendToUser(order.merchant.userId, 'order:rejected', {
        orderId,
        driverName: driverProfile.fullName,
        message: `${driverProfile.fullName} rechazó tu pedido`,
      });
      void this.notificationsService
        .notifyOrderRejected(order.id, order.merchant.userId, driverProfile.fullName)
        .catch(() => undefined);
    }

    // Volvió a concurso: re-alertar a la flota (proximidad + fail-open a
    // broadcast). Sin esto el pedido quedaba en pending invisible.
    if (order) {
      void this.alertNearbyDrivers(order as any, {
        id: order.id,
        orderId: order.id,
        pickupAddress: (order as any).pickupAddress,
        deliveryAddress: (order as any).deliveryAddress,
        deliveryZone: (order as any).deliveryZone ?? null,
        totalAmount: Number((order as any).totalAmount),
        driverPayout:
          (order as any).driverPayout != null ? Number((order as any).driverPayout) : null,
        distanceKm: Number((order as any).distanceKm),
        merchantName: (order as any).merchant?.businessName,
        createdAt: (order as any).createdAt,
      });
    }

    return order;
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
      pending: ['assigned', 'pending_acceptance', 'cancelled', 'no_driver'],
      driver_proposals: ['assigned', 'cancelled'],
      pending_acceptance: ['assigned', 'pending', 'cancelled'],
      assigned: ['in_transit_to_pickup', 'cancelled'],
      in_transit_to_pickup: ['picked_up', 'cancelled'],
      picked_up: ['in_transit_to_delivery'],
      in_transit_to_delivery: ['delivered'],
      delivered: [],
      cancelled: [],
      // Sin salida el pedido quedaba bricked: el concurso vencido no se podía
      // ni reintentar ni cancelar desde la UI del comercio.
      no_driver: ['pending', 'cancelled'],
    };

    if (!validTransitions[current]?.includes(next)) {
      throw new BadRequestException(`No se puede cambiar de ${current} a ${next}`);
    }
  }

  private validateStatusActor(
    current: string,
    next: string,
    actor: { isMerchantOwner: boolean; isAssignedDriver: boolean; role?: string },
  ) {
    if (actor.role === 'admin') return;
    const key = `${current}→${next}`;
    // El comercio solo cancela antes de que el pedido esté en ruta.
    const merchantAllowed = new Set([
      'pending→cancelled',
      'driver_proposals→cancelled',
      'assigned→cancelled',
      'no_driver→pending',
      'no_driver→cancelled',
    ]);
    // El repartidor avanza su ciclo y solo abandona antes de recoger.
    const driverAllowed = new Set([
      'assigned→in_transit_to_pickup',
      'assigned→cancelled',
      'pending_acceptance→assigned',
      'in_transit_to_pickup→picked_up',
      'picked_up→in_transit_to_delivery',
      'in_transit_to_delivery→delivered',
    ]);
    const ok =
      (actor.isMerchantOwner && merchantAllowed.has(key)) ||
      (actor.isAssignedDriver && driverAllowed.has(key));
    if (!ok) {
      throw new ForbiddenException(`Tu rol no puede cambiar de ${current} a ${next}`);
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
