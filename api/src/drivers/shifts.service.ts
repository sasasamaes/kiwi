import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ACTIVE_ORDER_STATUSES,
  blocksForToday,
  isInSchedule,
  minsOfDayCR,
} from './schedule-window';

const hhmm = (mins: number): string =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/**
 * Turnos del repartidor (Mi Horario): conecta/desconecta solo según lo
 * propuesto. Cada 5 min: fuera de horario y sin pedidos activos → offline
 * con aviso; fuera de horario pero entregando → se respeta, y al cruzar
 * 60 min fuera se manda un único recordatorio.
 */
@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async enforceSchedules(now = new Date()) {
    const online = await this.prisma.driverProfile.findMany({
      where: { status: 'available' },
      select: {
        id: true,
        userId: true,
        fullName: true,
        manualOnlineUntil: true,
        schedules: {
          where: { isAvailable: true },
          select: { dayOfWeek: true, startTime: true, endTime: true },
        },
      },
    });
    let offed = 0;
    let reminded = 0;
    for (const d of online) {
      try {
        const res = await this.enforceOne(d as any, now);
        if (res === 'off') offed += 1;
        if (res === 'reminded') reminded += 1;
      } catch (e) {
        this.logger.error(`shifts(${d.id}): ${String(e)}`);
      }
    }
    if (offed > 0 || reminded > 0) {
      this.logger.log(`shifts: ${offed} desconectados, ${reminded} avisados fuera de horario`);
    }
    return { checked: online.length, offed, reminded };
  }

  private async enforceOne(
    driver: {
      id: string;
      userId: string;
      schedules: Array<{ dayOfWeek: number; startTime: Date; endTime: Date }>;
    },
    now: Date,
  ): Promise<'off' | 'reminded' | 'ok'> {
    // Gracia manual: si se conectó solo fuera de horario, se respeta hasta
    // que venza (2 h). Vencida, corre el flujo normal.
    const graceUntil = (driver as any).manualOnlineUntil
      ? new Date((driver as any).manualOnlineUntil).getTime()
      : 0;
    if (graceUntil > now.getTime()) return 'ok';
    const nowMin = minsOfDayCR(now);
    const blocks = blocksForToday(driver.schedules as any, now);
    if (isInSchedule(driver.schedules as any, now)) return 'ok';

    const active = await this.prisma.order.count({
      where: { driverId: driver.id, status: { in: [...ACTIVE_ORDER_STATUSES] as any } },
    });
    if (active === 0) {
      await this.prisma.driverProfile.update({
        where: { id: driver.id },
        data: { status: 'offline' as any, manualOnlineUntil: null },
      });
      const lastEnd = Math.max(...blocks.filter((b) => b.end <= nowMin).map((b) => b.end), 0);
      await this.notifications
        .sendToUser(driver.userId, {
          title: '⏰ Terminó tu horario',
          body:
            lastEnd > 0
              ? `Te desconectamos: tu horario de hoy terminó a las ${hhmm(lastEnd)}. Si querés seguir, volvé a conectarte (vale 2 h más).`
              : 'Te desconectamos porque estás fuera de tu horario propuesto.',
          data: { type: 'shift_ended' },
        })
        .catch(() => undefined);
      return 'off';
    }
    // Con pedidos activos se respeta; un solo aviso al cruzar 60 min fuera.
    const ends = blocks.filter((b) => b.end <= nowMin).map((b) => b.end);
    if (ends.length === 0) return 'ok';
    const minsOutside = nowMin - Math.max(...ends);
    if (minsOutside >= 60 && minsOutside < 65) {
      await this.notifications
        .sendToUser(driver.userId, {
          title: '⏰ Seguís conectado fuera de tu horario',
          body: 'Tenés pedidos activos y por eso seguís en línea, pero tu horario ya terminó. Al entregar el último te desconectamos solo.',
          data: { type: 'shift_reminder' },
        })
        .catch(() => undefined);
      return 'reminded';
    }
    return 'ok';
  }
}
