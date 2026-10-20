// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from './orders.service';

/**
 * Expira aceptaciones y concursos vencidos. Todo vive en DB (timestamps):
 * un reinicio no pierde nada; el próximo barrido continúa. Cada transición
 * es un claim atómico (estado exacto + deadline) así que N instancias no
 * duplican trabajo ni notificaciones: solo el ganador notifica.
 *
 * Rendimiento: los claims siguen siendo por pedido (baratos, por PK), pero
 * los eventos se escriben con UN createMany por fase y las notificaciones
 * fan-out van en paralelo (Promise.allSettled). Antes era ~4 round-trips
 * serializados por pedido.
 */
@Injectable()
export class AssignmentSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssignmentSweeper.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private static readonly INTERVAL_MS = 60_000;

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private events: EventsGateway,
    private notifications: NotificationsService,
    private orders: OrdersService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      void this.sweepOnce().catch((e) => this.logger.error(`sweep failed: ${String(e)}`));
    }, AssignmentSweeper.INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async sweepOnce(): Promise<{
    acceptanceExpired: number;
    contestsExpired: number;
    paymentExpired: number;
  }> {
    if (this.running) return { acceptanceExpired: 0, contestsExpired: 0, paymentExpired: 0 };
    this.running = true;
    try {
      const { contestMinutes } = await this.settings.getAssignmentTimeouts();
      const now = new Date();
      let acceptanceExpired = 0;
      let contestsExpired = 0;
      let paymentExpired = 0;

      // ---- Fase 1: aceptaciones vencidas → vuelven a concurso ----
      const expired = await this.prisma.order.findMany({
        where: { status: 'pending_acceptance', acceptanceExpiresAt: { lt: now } },
        select: { id: true, driverId: true, merchantId: true },
      });
      const claimedAccept: typeof expired = [];
      for (const o of expired) {
        const claimed = await this.prisma.order.updateMany({
          where: {
            id: o.id,
            status: 'pending_acceptance',
            acceptanceExpiresAt: { lt: new Date() },
          },
          data: {
            driverId: null,
            status: 'pending',
            assignedAt: null,
            acceptanceExpiresAt: null,
            contestStartedAt: now,
            contestEndsAt: new Date(now.getTime() + contestMinutes * 60_000),
          },
        });
        if (claimed.count === 0) continue;
        claimedAccept.push(o);
        acceptanceExpired++;
      }
      if (claimedAccept.length > 0) {
        await this.prisma.orderEvent.createMany({
          data: claimedAccept.flatMap((o) => [
            { orderId: o.id, type: 'acceptance_expired', driverId: o.driverId },
            { orderId: o.id, type: 'contest_started', meta: { reason: 'timeout' } },
          ]),
        });
        const fulls: any[] = await this.prisma.order.findMany({
          where: { id: { in: claimedAccept.map((o) => o.id) } },
          include: { merchant: true },
        });
        await Promise.allSettled(
          fulls.map(async (full) => {
            if (full?.merchant?.userId) {
              this.events.sendToUser(full.merchant.userId, 'order:contestStarted', {
                orderId: full.id,
                message: 'El repartidor no aceptó a tiempo: el pedido entró en concurso.',
              });
              await this.notifications
                .notifyContestStarted(full.id, full.merchant.userId)
                .catch(() => undefined);
            }
            if (full) {
              await this.orders
                .alertNearbyDrivers(full, {
                  id: full.id,
                  orderId: full.id,
                  pickupAddress: full.pickupAddress,
                  deliveryAddress: full.deliveryAddress,
                  deliveryZone: full.deliveryZone ?? null,
                  totalAmount: Number(full.totalAmount),
                  driverPayout: full.driverPayout != null ? Number(full.driverPayout) : null,
                  distanceKm: Number(full.distanceKm),
                  merchantName: full.merchant?.businessName,
                  createdAt: full.createdAt,
                })
                .catch(() => undefined);
            }
          }),
        );
      }

      // ---- Fase 2: concursos vencidos → no_driver ----
      const stale = await this.prisma.order.findMany({
        where: { status: 'pending', driverId: null, contestEndsAt: { lt: now } },
        select: { id: true },
      });
      const claimedStale: typeof stale = [];
      for (const o of stale) {
        const claimed = await this.prisma.order.updateMany({
          where: { id: o.id, status: 'pending', driverId: null, contestEndsAt: { lt: new Date() } },
          data: { status: 'no_driver', contestStartedAt: null, contestEndsAt: null },
        });
        if (claimed.count === 0) continue;
        claimedStale.push(o);
        contestsExpired++;
      }
      if (claimedStale.length > 0) {
        await this.prisma.orderEvent.createMany({
          data: claimedStale.flatMap((o) => [
            { orderId: o.id, type: 'contest_expired' },
            { orderId: o.id, type: 'no_driver' },
          ]),
        });
        const fulls: any[] = await this.prisma.order.findMany({
          where: { id: { in: claimedStale.map((o) => o.id) } },
          include: { merchant: true },
        });
        await Promise.allSettled(
          fulls.map(async (full) => {
            if (full?.merchant?.userId) {
              this.events.sendToUser(full.merchant.userId, 'order:noDriver', {
                orderId: full.id,
                message:
                  'No hay repartidores disponibles para aceptar este pedido en este momento.',
              });
              await this.notifications
                .notifyNoDriverAvailable(full.id, full.merchant.userId)
                .catch(() => undefined);
            }
          }),
        );
      }

      // Pagos abandonados: el cliente creó el pedido pero nunca completó el
      // checkout (cerró Onvo, se quedó sin internet). Sin esto quedarían en
      // awaiting_payment para siempre, invisibles. 30 min de gracia.
      const unpaid = await this.prisma.order.findMany({
        where: {
          status: 'awaiting_payment',
          createdAt: { lt: new Date(Date.now() - 30 * 60_000) },
        },
        select: { id: true },
      });
      const claimedUnpaid: typeof unpaid = [];
      for (const o of unpaid) {
        const claimed = await this.prisma.order.updateMany({
          where: {
            id: o.id,
            status: 'awaiting_payment',
            createdAt: { lt: new Date(Date.now() - 30 * 60_000) },
          },
          data: { status: 'cancelled' },
        });
        if (claimed.count === 0) continue;
        claimedUnpaid.push(o);
        paymentExpired++;
      }
      if (claimedUnpaid.length > 0) {
        await this.prisma.orderEvent.createMany({
          data: claimedUnpaid.map((o) => ({ orderId: o.id, type: 'payment_expired' })),
        });
        const fulls: any[] = await this.prisma.order.findMany({
          where: { id: { in: claimedUnpaid.map((o) => o.id) } },
          include: { merchant: true },
        });
        for (const full of fulls) {
          if (full?.merchant?.userId) {
            this.events.sendToUser(full.merchant.userId, 'order:cancelled', {
              orderId: full.id,
              message: 'El pedido se canceló: el pago no se completó a tiempo.',
            });
          }
        }
      }
      return { acceptanceExpired, contestsExpired, paymentExpired };
    } finally {
      this.running = false;
    }
  }
}
