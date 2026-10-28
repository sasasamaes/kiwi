// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isKycRequired } from '../feature-flags/feature-flags';

/**
 * Liquidación semanal de repartidores (corte: martes 00:00 → lunes 24:00,
 * pago: martes). Costa Rica no tiene horario de verano: UTC-6 todo el año,
 * así que el desfase es una constante segura.
 */
const CR_OFFSET_MS = -6 * 3600 * 1000;
const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Martes 00:00 CR (inclusive) de la semana mar–lun que contiene a ref. */
export function payWeekStart(ref: Date = new Date()): Date {
  const cr = new Date(ref.getTime() + CR_OFFSET_MS);
  const dow = cr.getUTCDay(); // 0 dom … 2 mar … 6 sáb
  const daysSinceTue = (dow - 2 + 7) % 7;
  const tueCrMidnightUtc =
    Date.UTC(cr.getUTCFullYear(), cr.getUTCMonth(), cr.getUTCDate()) -
    CR_OFFSET_MS -
    daysSinceTue * 86400_000;
  return new Date(tueCrMidnightUtc);
}

/** Última semana mar–lun ya cerrada (la que se liquida el martes). */
export function lastClosedWeek(ref: Date = new Date()): { weekStart: Date; weekEnd: Date } {
  const weekStart = payWeekStart(new Date(ref.getTime() - WEEK_MS));
  return { weekStart, weekEnd: new Date(weekStart.getTime() + WEEK_MS) };
}

/** 'YYYY-MM-DD' interpretado como fecha de Costa Rica → inicio de su semana. */
export function payWeekStartFromISO(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) throw new BadRequestException('week inválido (AAAA-MM-DD)');
  // Mediodía UTC = mañana en CR: cae seguro dentro del día tico.
  return payWeekStart(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)));
}

@Injectable()
export class WithdrawalsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async getBalance(driverUserId: string) {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    // Calculate total earnings from completed orders (test excluded: no pagan).
    const totalEarnings = await this.prisma.order.aggregate({
      where: {
        driverId: driverProfile.id,
        status: 'delivered',
        isTest: false,
      },
      _sum: { driverPayout: true },
    });

    // Calculate total withdrawn
    const totalWithdrawn = await this.prisma.withdrawal.aggregate({
      where: {
        driverId: driverProfile.id,
        status: { in: ['completed', 'processing'] },
      },
      _sum: { amount: true },
    });

    // Calculate pending withdrawals
    const pendingWithdrawals = await this.prisma.withdrawal.aggregate({
      where: {
        driverId: driverProfile.id,
        status: 'pending',
      },
      _sum: { amount: true },
    });

    const total = Number(totalEarnings._sum?.driverPayout || 0);
    const withdrawn = Number(totalWithdrawn._sum?.amount || 0);
    const pending = Number(pendingWithdrawals._sum?.amount || 0);

    return {
      totalEarnings: total,
      totalWithdrawn: withdrawn,
      pendingWithdrawals: pending,
      availableBalance: total - withdrawn - pending,
    };
  }

  async requestWithdrawal(
    driverUserId: string,
    data: {
      amount: number;
      paymentMethod: 'sinpe' | 'bank_transfer';
      sinpePhone?: string;
      sinpeName?: string;
      bankName?: string;
      accountNumber?: string;
      accountHolder?: string;
    },
  ) {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    // Check KYC status — desactivado de momento (KYC_REQUIRED != 'true').
    if (isKycRequired() && driverProfile.kycStatus !== 'approved') {
      throw new BadRequestException('Debes completar la verificación KYC para retirar ganancias');
    }

    // Get current balance
    const balance = await this.getBalance(driverUserId);

    // Validate amount
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    if (data.amount > balance.availableBalance) {
      throw new BadRequestException('Saldo insuficiente');
    }

    // Minimum withdrawal amount (₡1,000)
    if (data.amount < 1000) {
      throw new BadRequestException('El monto mínimo de retiro es ₡1,000');
    }

    // Validate payment method details
    if (data.paymentMethod === 'sinpe') {
      if (!data.sinpePhone) {
        throw new BadRequestException('El número SINPE es requerido');
      }
    } else if (data.paymentMethod === 'bank_transfer') {
      if (!data.bankName || !data.accountNumber || !data.accountHolder) {
        throw new BadRequestException('Los datos bancarios son requeridos');
      }
    }

    // Create withdrawal request atomically: re-check balance inside tx
    // and serialize concurrent requests per driver with a transaction-scoped
    // advisory lock so two parallel requests cannot both pass the balance
    // check and double-spend the available balance.
    const withdrawal = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${driverProfile.id})::bigint)`;
      const [earnings, withdrawn, pending] = await Promise.all([
        tx.order.aggregate({
          where: { driverId: driverProfile.id, status: 'delivered', isTest: false },
          _sum: { driverPayout: true },
        }),
        tx.withdrawal.aggregate({
          where: { driverId: driverProfile.id, status: { in: ['completed', 'processing'] } },
          _sum: { amount: true },
        }),
        tx.withdrawal.aggregate({
          where: { driverId: driverProfile.id, status: 'pending' },
          _sum: { amount: true },
        }),
      ]);
      const available =
        Number(earnings._sum?.driverPayout || 0) -
        Number(withdrawn._sum?.amount || 0) -
        Number(pending._sum?.amount || 0);
      if (data.amount > available) {
        throw new BadRequestException('Saldo insuficiente');
      }
      return tx.withdrawal.create({
        data: {
          driverId: driverProfile.id,
          amount: data.amount,
          currency: 'CRC',
          status: 'pending',
          paymentMethod: data.paymentMethod,
          sinpePhone: data.sinpePhone,
          sinpeName: data.sinpeName,
          bankName: data.bankName,
          accountNumber: data.accountNumber,
          accountHolder: data.accountHolder,
        },
      });
    });

    // Create notification for admin
    await this.prisma.notification.create({
      data: {
        userId: driverUserId,
        title: 'Solicitud de Retiro',
        body: `Solicitaste retirar ₡${data.amount.toLocaleString()} vía ${data.paymentMethod === 'sinpe' ? 'SINPE' : 'Transferencia'}`,
        type: 'withdrawal_requested',
        data: { withdrawalId: withdrawal.id },
      },
    });

    return withdrawal;
  }

  async getMyWithdrawals(driverUserId: string, status?: string) {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    const where: any = { driverId: driverProfile.id };
    if (status) {
      where.status = status;
    }

    return this.prisma.withdrawal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWithdrawalById(id: string, driverUserId: string) {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
    });

    if (!withdrawal) {
      throw new NotFoundException('Retiro no encontrado');
    }

    if (withdrawal.driverId !== driverProfile.id) {
      throw new ForbiddenException('No tienes acceso a este retiro');
    }

    return withdrawal;
  }

  async cancelWithdrawal(id: string, driverUserId: string) {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
    });

    if (!withdrawal) {
      throw new NotFoundException('Retiro no encontrado');
    }

    if (withdrawal.driverId !== driverProfile.id) {
      throw new ForbiddenException('No tienes acceso a este retiro');
    }

    if (withdrawal.status !== 'pending') {
      throw new BadRequestException('Solo puedes cancelar retiros pendientes');
    }

    return this.prisma.withdrawal.update({
      where: { id },
      data: { status: 'failed' },
    });
  }

  // ============================================
  // 🧾 Planilla semanal (corte mar–lun, pago martes)
  // ============================================

  /** Viajes entregados sin recibo (no están en líneas de retiros vigentes). */
  private async unreceiptedDelivered(driverId: string, cutoff: Date) {
    return this.unreceiptedDeliveredTx(this.prisma, driverId, cutoff);
  }

  private async unreceiptedDeliveredTx(db: any, driverId: string, cutoff: Date) {
    const used = await db.withdrawalItem.findMany({
      where: {
        withdrawal: {
          driverId,
          status: { in: ['pending', 'processing', 'completed'] },
        },
      },
      select: { orderId: true },
    });
    const usedIds = new Set(used.map((u) => u.orderId));
    const orders = await db.order.findMany({
      where: {
        driverId,
        status: 'delivered',
        deliveredAt: { lte: cutoff },
        // Los test no generan saldo a pagar.
        isTest: false,
      },
      select: {
        id: true,
        deliveredAt: true,
        basePrice: true,
        driverPayout: true,
        merchant: { select: { businessName: true } },
      },
      orderBy: { deliveredAt: 'asc' },
    });
    return orders.filter((o) => !usedIds.has(o.id));
  }

  /**
   * Vista previa de la planilla de una semana (mar 00:00 → mar 00:00).
   * Por defecto solo viajes reales: los test no generan plata a pagar.
   * Con includeTest=true se incluyen marcados (pestaña TEST del admin).
   * Con `to` (YYYY-MM-DD) el corte se recorta a ese día inclusive: lo
   * posterior queda sin recibo para la próxima semana. Además arrastra el
   * rezago: entregados antes de weekStart y aún sin recibo (marcados
   * rezago:true) para que cuenten como cobro en este corte.
   */
  async getPayroll(weekISO?: string, includeTest = false, toISO?: string) {
    const weekStart = weekISO ? payWeekStartFromISO(weekISO) : lastClosedWeek().weekStart;
    const weekEnd = new Date(weekStart.getTime() + WEEK_MS);
    // Tope del corte: fin de la semana, o la fecha "hasta" si es anterior.
    let cutoff = weekEnd;
    if (toISO) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toISO.trim());
      if (!m) throw new BadRequestException('hasta inválido (AAAA-MM-DD)');
      if (Number(m[1]) < 2020 || Number(m[1]) > 2100) {
        throw new BadRequestException('hasta inválido (AAAA-MM-DD)');
      }
      // Inicio del día siguiente 00:00 CR = 06:00 UTC (corte inclusivo).
      const toEnd = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1, 6));
      if (toEnd <= weekStart) {
        throw new BadRequestException('el "hasta" debe caer dentro de la semana');
      }
      if (toEnd < cutoff) cutoff = toEnd;
    }

    const orders = await this.prisma.order.findMany({
      where: {
        status: 'delivered',
        deliveredAt: { lt: cutoff },
        driverId: { not: null },
        ...(includeTest ? {} : { isTest: false }),
      },
      select: {
        id: true,
        driverId: true,
        deliveredAt: true,
        basePrice: true,
        driverPayout: true,
        totalAmount: true,
        isTest: true,
        merchant: { select: { businessName: true } },
      },
      orderBy: { deliveredAt: 'asc' },
    });

    const receipted = await this.prisma.withdrawalItem.findMany({
      where: {
        withdrawal: { status: { in: ['pending', 'processing', 'completed'] } },
        orderId: { in: orders.map((o) => o.id) },
      },
      select: { orderId: true },
    });
    const receiptedIds = new Set(receipted.map((r) => r.orderId));
    const fresh = orders.filter((o) => o.driverId != null && !receiptedIds.has(o.id));

    const byDriver = new Map<string, typeof fresh>();
    for (const o of fresh) {
      const list = byDriver.get(o.driverId as string) ?? [];
      list.push(o);
      byDriver.set(o.driverId as string, list);
    }
    if (byDriver.size === 0) {
      return { weekStart, weekEnd, drivers: [] };
    }

    const profiles = await this.prisma.driverProfile.findMany({
      where: { id: { in: [...byDriver.keys()] } },
      select: {
        id: true,
        fullName: true,
        user: { select: { phone: true, email: true } },
      },
    });
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const existing = await this.prisma.withdrawal.findMany({
      where: {
        periodStart: weekStart,
        status: { in: ['pending', 'processing', 'completed'] },
      },
      select: { id: true, driverId: true, status: true, amount: true },
    });
    const existingByDriver = new Map(existing.map((w) => [w.driverId, w]));

    const drivers = [...byDriver.entries()].map(([driverId, trips]) => {
      const real = trips.filter((o: any) => !(o as any).isTest);
      const totalPayout = real.reduce((s, o) => s + Number(o.driverPayout ?? 0), 0);
      const totalTrip = real.reduce((s, o) => s + Number(o.basePrice ?? 0), 0);
      const rezagados = real.filter(
        (o: any) => o.deliveredAt && new Date(o.deliveredAt).getTime() < weekStart.getTime(),
      );
      const p = profileById.get(driverId);
      return {
        driverId,
        fullName: p?.fullName ?? '',
        phone: p?.user?.phone ?? null,
        email: p?.user?.email ?? null,
        tripCount: real.length,
        totalPayout: Math.round(totalPayout),
        totalTrip: Math.round(totalTrip),
        rezagoCount: rezagados.length,
        rezagoPayout: Math.round(rezagados.reduce((s, o) => s + Number(o.driverPayout ?? 0), 0)),
        testCount: trips.length - real.length,
        testPayout: Math.round(
          trips
            .filter((o: any) => (o as any).isTest)
            .reduce((s, o) => s + Number(o.driverPayout ?? 0), 0),
        ),
        existingWithdrawal: existingByDriver.get(driverId) ?? null,
        trips: trips.map((o: any) => ({
          id: o.id,
          deliveredAt: o.deliveredAt,
          merchant: o.merchant?.businessName ?? null,
          trip: Math.round(Number(o.basePrice ?? 0)),
          payout: Math.round(Number(o.driverPayout ?? 0)),
          isTest: (o as any).isTest === true,
          rezago: !!o.deliveredAt && new Date(o.deliveredAt).getTime() < weekStart.getTime(),
        })),
      };
    });

    const grandRezago = drivers.reduce((s, d: any) => s + Number(d.rezagoPayout ?? 0), 0);

    return { weekStart, weekEnd, cutoff, drivers, rezagoTotal: Math.round(grandRezago) };
  }

  /**
   * Genera los retiros de la semana (uno por repartidor con viajes
   * pendientes), con sus líneas de recibo congeladas. Idempotente por
   * repartidor+semana: no duplica si ya existe un retiro vigente.
   */
  async generatePayroll(
    weekISO: string | undefined,
    driverIds: string[] | undefined,
    toISO?: string,
  ) {
    const payroll: any = await this.getPayroll(weekISO, false, toISO);
    const wanted = new Set(driverIds ?? []);
    const eligible = payroll.drivers.filter(
      (d: any) =>
        (wanted.size === 0 || wanted.has(d.driverId)) && !d.existingWithdrawal && d.totalPayout > 0,
    );
    if (eligible.length === 0) {
      throw new BadRequestException('No hay nada que liquidar en esa semana');
    }

    const created: any[] = [];
    const skipped: Array<{ driverId: string; reason: string }> = [];
    for (const d of eligible) {
      try {
        const w = await this.prisma.$transaction(async (tx) => {
          const dupe = await tx.withdrawal.findFirst({
            where: {
              driverId: d.driverId,
              periodStart: payroll.weekStart,
              status: { in: ['pending', 'processing', 'completed'] },
            },
            select: { id: true },
          });
          if (dupe) throw new BadRequestException('duplicate');
          // Destino del pago: último método usado; si no, SINPE al teléfono.
          const last = await tx.withdrawal.findFirst({
            where: {
              driverId: d.driverId,
              status: { in: ['pending', 'processing', 'completed'] },
            },
            orderBy: { createdAt: 'desc' },
          });
          const paymentMethod = (last?.paymentMethod as any) ?? 'sinpe';
          const dest =
            paymentMethod === 'bank_transfer'
              ? {
                  bankName: (last as any)?.bankName ?? undefined,
                  accountNumber: (last as any)?.accountNumber ?? undefined,
                  accountHolder: (last as any)?.accountHolder ?? undefined,
                }
              : {
                  sinpePhone: (last as any)?.sinpePhone ?? d.phone ?? undefined,
                  sinpeName: (last as any)?.sinpeName ?? d.fullName ?? undefined,
                };
          if (paymentMethod === 'bank_transfer' && !(dest as any).accountNumber) {
            throw new BadRequestException('no-bank-data');
          }
          const withdrawal = await tx.withdrawal.create({
            data: {
              driverId: d.driverId,
              amount: d.totalPayout,
              currency: 'CRC',
              status: 'pending',
              paymentMethod,
              ...dest,
              periodStart: payroll.weekStart,
              periodEnd: payroll.weekEnd,
            },
          });
          await tx.withdrawalItem.createMany({
            data: d.trips.map((t: any) => ({
              withdrawalId: withdrawal.id,
              orderId: t.id,
              amount: t.payout,
              deliveredAt: t.deliveredAt,
            })),
          });
          return withdrawal;
        });
        created.push(w);
      } catch (e: any) {
        if (String(e?.message ?? '').includes('duplicate')) {
          skipped.push({ driverId: d.driverId, reason: 'duplicate' });
        } else {
          skipped.push({ driverId: d.driverId, reason: String(e?.message ?? 'error') });
        }
      }
    }
    return { weekStart: payroll.weekStart, weekEnd: payroll.weekEnd, created, skipped };
  }

  /**
   * Marca la semana como pagada: completa de una vez todos los retiros
   * generados de la planilla (pending/processing) con el comprobante SINPE.
   * Es el "poner en 0" del corte: después de esto el disponible del
   * repartidor queda en 0 porque ya cobró, no porque falte plata.
   */
  async completePayrollWeek(
    weekISO: string | undefined,
    transactionId: string,
    adminUserId: string,
  ) {
    const txId = String(transactionId ?? '').trim();
    if (!txId) {
      throw new BadRequestException('transactionId es requerido (comprobante del pago)');
    }
    const weekStart = weekISO ? payWeekStartFromISO(weekISO) : lastClosedWeek().weekStart;
    const pending = await this.prisma.withdrawal.findMany({
      where: { periodStart: weekStart, status: { in: ['pending', 'processing'] } },
      select: {
        id: true,
        amount: true,
        driver: { select: { userId: true } },
      },
    });
    if (pending.length === 0) {
      throw new BadRequestException(
        'No hay retiros por pagar en esa semana (generá la planilla primero)',
      );
    }
    let completed = 0;
    let total = 0;
    for (const w of pending) {
      const claimed = await this.prisma.withdrawal.updateMany({
        where: { id: w.id, status: { in: ['pending', 'processing'] } },
        data: {
          status: 'completed',
          processedAt: new Date(),
          processedBy: adminUserId,
          transactionId: txId,
        },
      });
      if (claimed.count > 0) {
        completed += 1;
        total += Number((w as any).amount ?? 0);
        const userId = (w as any).driver?.userId;
        if (userId) {
          await this.notificationsService
            .notifyWithdrawalStatus(userId, 'completed', Number((w as any).amount ?? 0))
            .catch(() => null);
        }
      }
    }
    return {
      weekStart,
      weekEnd: new Date(weekStart.getTime() + WEEK_MS),
      completed,
      total: Math.round(total),
    };
  }

  /** Recibo de un retiro: líneas de viajes + totales. */
  async getReceipt(id: string, opts: { driverUserId?: string; isAdmin?: boolean }) {
    const withdrawal: any = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            order: {
              select: {
                id: true,
                deliveredAt: true,
                basePrice: true,
                driverPayout: true,
                totalAmount: true,
                merchant: { select: { businessName: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        driver: {
          select: {
            id: true,
            fullName: true,
            user: { select: { phone: true, email: true } },
          },
        },
      },
    });
    if (!withdrawal) throw new NotFoundException('Retiro no encontrado');
    if (!opts.isAdmin) {
      const profile = await this.prisma.driverProfile.findUnique({
        where: { userId: opts.driverUserId },
        select: { id: true },
      });
      if (!profile || withdrawal.driverId !== profile.id) {
        throw new ForbiddenException('No tienes acceso a este retiro');
      }
    }
    const tripsTotal = withdrawal.items.reduce(
      (s: number, it: any) => s + Number(it.amount ?? 0),
      0,
    );
    return {
      id: withdrawal.id,
      amount: Number(withdrawal.amount),
      currency: withdrawal.currency,
      status: withdrawal.status,
      paymentMethod: withdrawal.paymentMethod,
      sinpePhone: withdrawal.sinpePhone,
      sinpeName: withdrawal.sinpeName,
      bankName: withdrawal.bankName,
      accountNumber: withdrawal.accountNumber,
      accountHolder: withdrawal.accountHolder,
      periodStart: withdrawal.periodStart,
      periodEnd: withdrawal.periodEnd,
      transactionId: withdrawal.transactionId,
      createdAt: withdrawal.createdAt,
      driver: {
        fullName: withdrawal.driver?.fullName,
        phone: withdrawal.driver?.user?.phone,
        email: withdrawal.driver?.user?.email,
      },
      trips: withdrawal.items.map((it: any) => ({
        orderId: it.orderId,
        deliveredAt: it.deliveredAt ?? it.order?.deliveredAt,
        merchant: it.order?.merchant?.businessName ?? null,
        trip: it.order?.basePrice != null ? Math.round(Number(it.order.basePrice)) : null,
        payout: Math.round(Number(it.amount ?? 0)),
      })),
      tripsTotal: Math.round(tripsTotal),
      tripCount: withdrawal.items.length,
    };
  }

  /** Adjunta recibo FIFO a un retiro manual (al aprobar): viajes entregados
   *  sin recibo hasta cubrir el monto. No toca retiros que ya traen líneas. */
  private async attachFifoReceipt(withdrawalId: string) {
    const existing = await this.prisma.withdrawalItem.count({ where: { withdrawalId } });
    if (existing > 0) return;
    const withdrawal: any = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });
    if (!withdrawal) return;
    const trips = await this.unreceiptedDelivered(withdrawal.driverId, withdrawal.createdAt);
    let acc = 0;
    const target = Number(withdrawal.amount ?? 0);
    const picked: typeof trips = [];
    for (const o of trips) {
      picked.push(o);
      acc += Number(o.driverPayout ?? 0);
      if (acc >= target) break;
    }
    if (picked.length === 0) return;
    await this.prisma.withdrawalItem.createMany({
      data: picked.map((o) => ({
        withdrawalId,
        orderId: o.id,
        amount: Math.round(Number(o.driverPayout ?? 0)),
        deliveredAt: o.deliveredAt,
      })),
    });
  }

  /**
   * Saldos sin liquidar por repartidor: viajes entregados sin recibo,
   * más conteo de retiros pendientes (esos bloquean el ajuste).
   */
  async getUnsettledBalances() {
    const now = new Date();
    const trips = await this.prisma.order.findMany({
      // Solo reales: los test no generan saldo a pagar.
      where: { status: 'delivered', driverId: { not: null }, isTest: false },
      select: { id: true, driverId: true, deliveredAt: true, driverPayout: true },
      orderBy: { deliveredAt: 'asc' },
    });
    const used = await this.prisma.withdrawalItem.findMany({
      where: {
        withdrawal: { status: { in: ['pending', 'processing', 'completed'] } },
        orderId: { in: trips.map((o) => o.id) },
      },
      select: { orderId: true },
    });
    const usedIds = new Set(used.map((u) => u.orderId));
    const byDriver = new Map<string, typeof trips>();
    for (const o of trips) {
      if (!o.driverId || usedIds.has(o.id)) continue;
      const list = byDriver.get(o.driverId) ?? [];
      list.push(o);
      byDriver.set(o.driverId, list);
    }
    if (byDriver.size === 0) return [];
    const [drivers, pendings] = await Promise.all([
      this.prisma.driverProfile.findMany({
        where: { id: { in: [...byDriver.keys()] } },
        select: {
          id: true,
          fullName: true,
          user: { select: { phone: true, email: true } },
        },
      }),
      this.prisma.withdrawal.groupBy({
        by: ['driverId'],
        where: { status: 'pending' },
        _count: { id: true },
      }),
    ]);
    const pendingByDriver = new Map(pendings.map((r: any) => [r.driverId, r._count.id]));
    return [...byDriver.entries()].map(([driverId, list]) => {
      const p = drivers.find((d) => d.id === driverId);
      return {
        driverId,
        fullName: p?.fullName ?? '',
        phone: p?.user?.phone ?? null,
        email: p?.user?.email ?? null,
        tripCount: list.length,
        totalPayout: Math.round(list.reduce((s, o) => s + Number(o.driverPayout ?? 0), 0)),
        pendingCount: pendingByDriver.get(driverId) ?? 0,
      };
    });
  }

  /**
   * Pone en 0 el saldo de un repartidor: crea un retiro 'completed' por el
   * total pendiente con recibo de todos sus viajes sin liquidar. Auditable
   * (processedBy + transactionId AJUSTE). No toca retiros pendientes: si
   * tiene, hay que resolverlos primero.
   */
  async zeroOutDriver(driverId: string, adminId: string, reason: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Repartidor no encontrado');
    const pending = await this.prisma.withdrawal.count({
      where: { driverId, status: 'pending' },
    });
    if (pending > 0) {
      throw new BadRequestException(
        'El repartidor tiene retiros pendientes: resolvelos antes de poner en 0',
      );
    }
    const trips = await this.unreceiptedDelivered(driverId, new Date());
    const total = Math.round(trips.reduce((s, o) => s + Number(o.driverPayout ?? 0), 0));
    if (trips.length === 0 || total <= 0) {
      throw new BadRequestException('No hay saldo pendiente para poner en 0');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${driverId})::bigint)`;
      // Recalcular dentro del lock: un doble clic no duplica el ajuste.
      const fresh = await this.unreceiptedDeliveredTx(tx, driverId, new Date());
      const freshTotal = Math.round(fresh.reduce((sum, o) => sum + Number(o.driverPayout ?? 0), 0));
      if (fresh.length === 0 || freshTotal <= 0) {
        throw new BadRequestException('Ya no hay saldo pendiente (otro ajuste lo cubrió)');
      }
      const withdrawal = await tx.withdrawal.create({
        data: {
          driverId,
          amount: freshTotal,
          currency: 'CRC',
          status: 'completed',
          paymentMethod: 'sinpe',
          processedAt: new Date(),
          processedBy: adminId,
          transactionId: `AJUSTE - ${reason || 'saldo inicial'}`.slice(0, 120),
        },
      });
      await tx.withdrawalItem.createMany({
        data: fresh.map((o) => ({
          withdrawalId: withdrawal.id,
          orderId: o.id,
          amount: Math.round(Number(o.driverPayout ?? 0)),
          deliveredAt: o.deliveredAt,
        })),
      });
      return { ...withdrawal, tripCount: fresh.length };
    });
  }

  // Admin methods
  async getAllPendingWithdrawals() {
    return this.prisma.withdrawal.findMany({
      where: { status: 'pending' },
      include: {
        driver: {
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
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveWithdrawal(id: string, adminUserId: string, transactionId?: string) {
    // Atómico: solo un admin puede sacar el retiro de 'pending'. Doble clic
    // o dos admins concurrentes → el perdedor ve count 0 y recibe error.
    const claimed = await this.prisma.withdrawal.updateMany({
      where: { id, status: 'pending' },
      data: {
        status: 'processing',
        processedAt: new Date(),
        processedBy: adminUserId,
        transactionId,
      },
    });
    if (claimed.count === 0) {
      const current = await this.prisma.withdrawal.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Retiro no encontrado');
      throw new BadRequestException('El retiro ya fue procesado');
    }
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: { driver: true },
    });

    // Recibo automático para retiros manuales (los de planilla ya traen líneas).
    try {
      await this.attachFifoReceipt(id);
    } catch {
      // best-effort: la aprobación ya quedó y no se revierte por el recibo
    }

    // Notify driver (push + inbox vía notifications service)
    await this.notificationsService
      .notifyWithdrawalStatus(withdrawal.driver.userId, 'processing', Number(withdrawal.amount))
      .catch(() => null);

    return withdrawal;
  }

  async completeWithdrawal(id: string, transactionId: string) {
    // Atómico: solo se puede completar desde 'processing'.
    const claimed = await this.prisma.withdrawal.updateMany({
      where: { id, status: 'processing' },
      data: {
        status: 'completed',
        transactionId,
      },
    });
    if (claimed.count === 0) {
      const current = await this.prisma.withdrawal.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Retiro no encontrado');
      throw new BadRequestException('El retiro no está en proceso');
    }
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: { driver: true },
    });

    // Notify driver (push + inbox vía notifications service)
    await this.notificationsService
      .notifyWithdrawalStatus(withdrawal.driver.userId, 'completed', Number(withdrawal.amount))
      .catch(() => null);

    return withdrawal;
  }

  async rejectWithdrawal(id: string, adminUserId: string, reason: string) {
    // Atómico: solo se puede rechazar desde 'pending'.
    const claimed = await this.prisma.withdrawal.updateMany({
      where: { id, status: 'pending' },
      data: {
        status: 'rejected',
        rejectionReason: reason,
        processedAt: new Date(),
        processedBy: adminUserId,
      },
    });
    if (claimed.count === 0) {
      const current = await this.prisma.withdrawal.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Retiro no encontrado');
      throw new BadRequestException('El retiro ya fue procesado');
    }
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: { driver: true },
    });

    // Notify driver (push + inbox vía notifications service)
    await this.notificationsService
      .notifyWithdrawalStatus(withdrawal.driver.userId, 'rejected', Number(withdrawal.amount))
      .catch(() => null);

    return withdrawal;
  }
}
