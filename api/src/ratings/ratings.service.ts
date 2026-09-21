import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
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
    private readonly notificationsService: NotificationsService,
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

    // Push + inbox (topic driver.ratings, respeta preferencias)
    await this.notificationsService
      .notifyNewRating(order.driver.user.id, dto.rating, order.merchant.businessName)
      .catch(() => null);

    return rating;
  }

  /**
   * Lista de comentarios para el admin: paginada, filtrable por estrellas
   * y con nombres de comercio/repartidor. Solo comentarios con texto o
   * con baja calificación suben primero si se pide.
   */
  async listForAdmin(opts: {
    take?: number;
    skip?: number;
    minRating?: number;
    maxRating?: number;
    onlyWithComment?: boolean;
  }) {
    const take = Math.min(Math.max(Number(opts.take ?? 20), 1), 100);
    const skip = Math.max(Number(opts.skip ?? 0), 0);
    const where: any = {};
    if (opts.minRating != null)
      where.rating = { ...(where.rating ?? {}), gte: Number(opts.minRating) };
    if (opts.maxRating != null)
      where.rating = { ...(where.rating ?? {}), lte: Number(opts.maxRating) };
    if (opts.onlyWithComment) where.comment = { not: null };

    const [total, items, avg] = await Promise.all([
      this.prisma.rating.count({ where }),
      this.prisma.rating.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          driver: { select: { fullName: true } },
          merchant: { select: { businessName: true } },
          order: { select: { id: true, deliveryAddress: true, createdAt: true } },
        },
      }),
      this.prisma.rating.aggregate({ _avg: { rating: true }, _count: { rating: true } }),
    ]);

    return {
      total,
      items,
      summary: {
        average: Number(avg._avg?.rating ?? 0),
        count: avg._count.rating,
      },
    };
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

  /**
   * Lookup público para el link de calificación (invitados que pidieron sin
   * cuenta). Mismo modelo de confianza que el tracking público: quien tiene
   * el link es parte del pedido. Solo datos necesarios para calificar.
   */
  async findByOrderPublic(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        merchant: { select: { businessName: true } },
        driver: { select: { id: true, fullName: true, rating: true, vehicleType: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    const rating = await this.prisma.rating.findFirst({
      where: { orderId },
    });

    return {
      order: {
        id: order.id,
        status: order.status,
        merchant: order.merchant ? { businessName: (order.merchant as any).businessName } : null,
        driver: order.driverId
          ? {
              id: (order.driver as any)?.id ?? null,
              fullName: (order.driver as any)?.fullName ?? null,
              rating: (order.driver as any)?.rating ?? null,
              vehicleType: (order.driver as any)?.vehicleType ?? null,
            }
          : null,
      },
      rating,
      canRate: order.status === 'delivered' && !rating && !!order.driverId,
    };
  }

  /**
   * Calificación pública desde el link (invitado). Sin chequeo de dueño —
   * el link ES la credencial — pero con todos los demás guards: entregado,
   * con repartidor, una sola vez, 1-5 estrellas (vía DTO).
   */
  async createPublic(dto: CreateRatingDto) {
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

    this.events.sendToUser(order.driver.user.id, 'rating:new', {
      ratingId: rating.id,
      orderId: order.id,
      rating: dto.rating,
      comment: rating.comment,
    });

    await this.notificationsService
      .notifyNewRating(order.driver.user.id, dto.rating, order.merchant.businessName)
      .catch(() => null);

    return rating;
  }
}
