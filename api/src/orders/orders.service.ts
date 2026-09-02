import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
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

    // Calculate pricing based on distance
    const distanceKm = data.distanceKm || 0;
    const basePrice = this.calculateBasePrice(distanceKm);
    const commission = basePrice * 0.05; // 5% commission (low for Nicoya launch)
    const driverPayout = basePrice - commission;

    const order = await this.prisma.order.create({
      data: {
        merchantId: merchantProfile.id,
        status: data.orderType === 'scheduled' ? 'driver_proposals' : 'pending',
        orderType: data.orderType || 'immediate',
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
        scheduledTime: data.scheduledTime,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        deliveryAddress: data.deliveryAddress,
        deliveryLat: data.deliveryLat,
        deliveryLng: data.deliveryLng,
        distanceKm,
        basePrice,
        commission,
        driverPayout,
        totalAmount: basePrice,
        specialInstructions: data.specialInstructions,
      },
      include: {
        merchant: true,
      },
    });

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

  async findByMerchant(userId: string, status?: string) {
    const merchantProfile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
    });

    if (!merchantProfile) {
      return [];
    }

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

  async assignDriver(orderId: string, driverId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { merchant: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (order.status !== 'pending' && order.status !== 'driver_proposals') {
      throw new BadRequestException('El pedido no está disponible');
    }

    // Verify driver exists
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Repartidor no encontrado');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        driverId,
        status: 'assigned',
        assignedAt: new Date(),
      },
      include: {
        merchant: true,
        driver: true,
      },
    });

    // Notify the assigned driver
    this.eventsGateway.sendToUser(driverProfile.userId, 'order:assigned', {
      orderId: updatedOrder.id,
      pickupAddress: updatedOrder.pickupAddress,
      deliveryAddress: updatedOrder.deliveryAddress,
      totalAmount: Number(updatedOrder.totalAmount),
      message: 'Te asignaron un pedido',
    });

    // Notify merchant
    if (order.merchant?.userId) {
      this.eventsGateway.sendToUser(order.merchant.userId, 'order:driverAssigned', {
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

    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
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

    // Accept proposal and assign driver
    await this.prisma.driverProposal.update({
      where: { id: proposalId },
      data: { status: 'accepted' },
    });

    // Reject other proposals
    await this.prisma.driverProposal.updateMany({
      where: {
        orderId,
        id: { not: proposalId },
      },
      data: { status: 'rejected' },
    });

    // Assign driver to order
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        driverId: proposal.driverId,
        status: 'assigned',
        assignedAt: new Date(),
      },
      include: {
        merchant: true,
        driver: true,
      },
    });

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
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { merchant: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (order.status !== 'pending') {
      throw new BadRequestException('El pedido ya fue tomado por otro repartidor');
    }

    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    // Assign driver
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        driverId: driverProfile.id,
        status: 'assigned',
        assignedAt: new Date(),
      },
      include: {
        merchant: true,
        driver: true,
      },
    });

    // Notify merchant
    if (order.merchant?.userId) {
      this.eventsGateway.sendToUser(order.merchant.userId, 'order:accepted', {
        orderId: updatedOrder.id,
        driverId: driverProfile.id,
        driverName: driverProfile.fullName,
        vehicleType: driverProfile.vehicleType,
        message: `${driverProfile.fullName} aceptó tu pedido`,
      });

      await this.createNotification(
        order.merchant.userId,
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

  private calculateBasePrice(distanceKm: number): number {
    // Nicoya-specific pricing (colonial town, short distances)
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
