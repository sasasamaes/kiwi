import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(merchantId: string, data: any) {
    // Calculate pricing based on distance
    const basePrice = this.calculateBasePrice(data.distanceKm || 0);
    const commission = basePrice * 0.10; // 10% commission
    const driverPayout = basePrice - commission;

    return this.prisma.order.create({
      data: {
        merchantId,
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
        distanceKm: data.distanceKm,
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

    // Check if user has access to this order
    if (order.merchantId !== userId && order.driverId !== userId) {
      throw new ForbiddenException('No tienes acceso a este pedido');
    }

    return order;
  }

  async findByMerchant(merchantId: string, status?: string) {
    const where: any = { merchantId };
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
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByDriver(driverId: string, status?: string) {
    const where: any = { driverId };
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

    return this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });
  }

  async assignDriver(orderId: string, driverId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (order.status !== 'pending' && order.status !== 'driver_proposals') {
      throw new BadRequestException('El pedido no está disponible');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        driverId,
        status: 'assigned',
        assignedAt: new Date(),
      },
    });
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

  async submitProposal(orderId: string, driverId: string, data: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (order.orderType !== 'scheduled') {
      throw new BadRequestException('Solo puedes proponer en pedidos programados');
    }

    return this.prisma.driverProposal.create({
      data: {
        orderId,
        driverId,
        estimatedArrival: data.estimatedArrival,
        message: data.message,
      },
    });
  }

  async acceptProposal(orderId: string, proposalId: string, merchantId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (order.merchantId !== merchantId) {
      throw new ForbiddenException('No puedes aceptar propuestas de otros pedidos');
    }

    const proposal = await this.prisma.driverProposal.findUnique({
      where: { id: proposalId },
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
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        driverId: proposal.driverId,
        status: 'assigned',
        assignedAt: new Date(),
      },
    });
  }

  private calculateBasePrice(distanceKm: number): number {
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
}
