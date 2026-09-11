import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { CreateRatingDto } from './dto/create-rating.dto';

const ROUNDING = 2;

/** Recalcula el promedio del repartidor a partir de sus ratings reales. */
async function recalcDriverRating(prisma: PrismaService, driverId: string): Promise<void> {
  const agg = await prisma.rating.aggregate({
    where: { driverId },
    _avg: { rating: true },
  });

  const avg = agg._avg.rating ?? 5.0;
  await prisma.driverProfile.update({
    where: { id: driverId },
    data: { rating: Number(avg.toFixed(ROUNDING)) },
  });
}

@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  /**
   * El comercio califica al repartidor de un pedido entregado.
   * Un solo rating por pedido; autoría y estado verificados en servidor.
   */
  async create(merchantUserId: string, dto: CreateRatingDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        driver: { include: { user: { select: { id: true } } } },
        merchant: { include: { user: { select: { id: true } } } },
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }
    if (order.merchant?.userId !== merchantUserId) {
      throw new ForbiddenException('Solo el comercio del pedido puede calificarlo');
    }
    if (order.status !== 'delivered') {
      throw new BadRequestException('Solo se pueden calificar pedidos entregados');
    }
    if (!order.driver) {
      throw new BadRequestException('El pedido no tiene repartidor asignado');
    }

    const existing = await this.prisma.rating.findFirst({
      where: { orderId: order.id },
    });
    if (existing) {
      throw new ConflictException('Este pedido ya fue calificado');
    }

    const rating = await this.prisma.rating.create({
      data: {
        orderId: order.id,
        driverId: order.driver.id,
        merchantId: order.merchant.id,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
        onTime: dto.onTime ?? null,
        carefulWithOrder: dto.carefulWithOrder ?? null,
      },
    });

    await recalcDriverRating(this.prisma, order.driver.id);

    // Avisar al repartidor en tiempo real
    this.events.sendToUser(order.driver.user.id, 'rating:new', {
      ratingId: rating.id,
      orderId: order.id,
      rating: dto.rating,
      comment: rating.comment,
    });

    return rating;
  }

  /** Rating existente para un pedido (o null) — el usuario debe ser parte del pedido. */
  async findByOrder(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        driver: { include: { user: { select: { id: true } } } },
        merchant: { include: { user: { select: { id: true } } } },
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }
    const isMerchant = order.merchant?.userId === userId;
    const isDriver = order.driver?.userId === userId;
    if (!isMerchant && !isDriver) {
      throw new ForbiddenException('No tienes acceso a este pedido');
    }

    const rating = await this.prisma.rating.findFirst({
      where: { orderId },
    });

    return { rating, canRate: isMerchant && order.status === 'delivered' && !rating };
  }
}
