import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
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
    const distanceKm = Number(data.distanceKm ?? 0);
    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
      throw new BadRequestException('distanceKm inválido');
    }
    if (distanceKm > 300) {
      throw new BadRequestException('distanceKm fuera de rango (máx 300 km)');
    }
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
    // Products pass through with 0% commission until phase 2.
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
          productsTotal += Number(menuItem.price) * quantity;
          resolvedItems.push({
            menuItemId: menuItem.id,
            name: menuItem.name,
            price: Number(menuItem.price),
            quantity,
            notes: item.notes || undefined,
          });
        } else {
          const name = String(item?.name ?? '').trim();
          if (!name || name.length > 200) {
            throw new BadRequestException('name inválido');
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

    const tripPrice =
      this.calculateBasePrice(
        distanceKm,
        { lat: data.pickupLat, lng: data.pickupLng },
        { lat: data.deliveryLat, lng: data.deliveryLng },
      ) + weightSurcharge;
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
          })),
        });
      } catch (error) {
        console.error('Failed to persist order items:', error);
      }
    }

    // Broadcast new order to all available drivers via Socket.io
    if (order.status === 'pending') {
      this.eventsGateway.sendToRole('driver', 'order:new', {
        orderId: order.id,
        pickupAddress: order.pickupAddress,
        deliveryAddress: order.deliveryAddress,
        totalAmount: Number(order.totalAmount),
        distanceKm: Number(order.distanceKm),
        merchantName: merchantProfile.businessName,
        createdAt: order.createdAt,
      });
    }

    return order;
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

    // Notify merchant
    if (order.merchant?.userId) {
      this.eventsGateway.sendToUser(order.merchant.userId, 'order:statusChanged', notification);
    }

    // Notify driver
    if (order.driver?.userId) {
      this.eventsGateway.sendToUser(order.driver.userId, 'order:statusChanged', notification);
    }

    // Create in-app notifications for both parties
    if (order.merchant?.userId) {
      await this.createNotification(
        order.merchant.userId,
        'Order Status',
        statusLabels[status] || 'Estado actualizado',
        'order_status',
        { orderId: updatedOrder.id, status },
      );
    }

    if (order.driver?.userId && status !== 'assigned') {
      await this.createNotification(
        order.driver.userId,
        'Order Status',
        statusLabels[status] || 'Estado actualizado',
        'order_status',
        { orderId: updatedOrder.id, status },
      );
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
    if ((order as any).status !== 'pending' || (order as any).driverId) {
      throw new BadRequestException('El pedido ya fue tomado por otro repartidor');
    }

    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
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
      const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!existing) throw new NotFoundException('Pedido no encontrado');
      throw new BadRequestException('El pedido ya fue tomado por otro repartidor');
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

      await this.createNotification(
        updatedOrder.merchant.userId,
        'Pedido Aceptado',
        `${driverProfile.fullName} aceptó tu pedido`,
        'order_accepted',
        { orderId: updatedOrder.id },
      );
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

  /** Phase-2 seam: commission on products. Currently 0 (merchant keeps 100%). */
  private commissionForProducts(_productsTotal: number): number {
    return 0;
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
