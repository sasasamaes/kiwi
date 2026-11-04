// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { startOfTodayCR, CR_OFFSET_MS } from '../common/costa-rica-time';

const KINDS = ['cuota', 'aporte', 'extra'] as const;
const EXPENSE_KINDS = [
  'mantenimiento',
  'seguro',
  'gasolina',
  'repuesto',
  'marchamo',
  'otro',
] as const;

/**
 * Deudas del negocio (ej. la moto a mensualidades) y sus pagos: cuotas,
 * aportes de repartidores y abonos extra. Todo número sale de la DB; el
 * resumen (saldo, avance, proyección de fin) se deriva acá para que el
 * admin y los reportes vean lo mismo.
 */
@Injectable()
export class DebtsService {
  constructor(private readonly prisma: PrismaService) {}

  private toNum(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** Resumen derivado: pagado, saldo, avance y fecha estimada de fin. */
  summarize(debt: any, payments: any[]) {
    const total = this.toNum(debt.totalAmount);
    const down = this.toNum(debt.downPayment);
    const paid = payments.reduce((s, p) => s + this.toNum(p.amount), 0);
    const paidTotal = down + paid;
    const balance = Math.max(0, Math.round((total - paidTotal) * 100) / 100);
    const pct = total > 0 ? Math.min(100, Math.round((paidTotal / total) * 1000) / 10) : 0;
    const monthly = this.toNum(debt.monthlyAmount);
    const monthsLeft = monthly > 0 && balance > 0 ? Math.ceil(balance / monthly - 1e-9) : 0;
    const payoffAt =
      balance <= 0
        ? new Date().toISOString()
        : monthly > 0
          ? // Día 1 del mes de liquidación, 00:00 CR (= 06:00 UTC).
            new Date(
              Date.UTC(
                new Date(Date.now() + CR_OFFSET_MS).getUTCFullYear(),
                new Date(Date.now() + CR_OFFSET_MS).getUTCMonth() + monthsLeft,
                1,
                6,
              ),
            ).toISOString()
          : null;
    const byDriver: Record<string, { driverId: string; name: string; total: number }> = {};
    const byKind: Record<string, number> = { cuota: 0, aporte: 0, extra: 0 };
    for (const p of payments) {
      const amt = this.toNum(p.amount);
      if (p.kind != null) byKind[String(p.kind)] = (byKind[String(p.kind)] ?? 0) + amt;
      if (p.driverId) {
        const key = String(p.driverId);
        byDriver[key] = byDriver[key] ?? {
          driverId: key,
          name: p.driver?.fullName ?? 'Repartidor',
          total: 0,
        };
        byDriver[key].total = Math.round((byDriver[key].total + amt) * 100) / 100;
      }
    }
    return {
      total,
      downPayment: down,
      paid,
      paidTotal: Math.round(paidTotal * 100) / 100,
      balance,
      pct,
      settled: balance <= 0,
      monthly,
      monthsLeft,
      payoffAt,
      byKind,
      byDriver: Object.values(byDriver).sort((a, b) => b.total - a.total),
    };
  }

  async list() {
    const debts = await this.prisma.debt.findMany({ orderBy: { createdAt: 'desc' } });
    const out = [];
    for (const d of debts) {
      const payments = await this.prisma.debtPayment.findMany({ where: { debtId: d.id } });
      out.push({ ...this.shape(d), summary: this.summarize(d, payments) });
    }
    return out;
  }

  async detail(id: string) {
    const debt = await this.prisma.debt.findUnique({ where: { id } });
    if (!debt) throw new NotFoundException('Deuda no encontrada');
    const [payments, parts, expRows] = await Promise.all([
      this.prisma.debtPayment.findMany({
        where: { debtId: id },
        include: { driver: { select: { id: true, fullName: true } } },
        orderBy: { paidAt: 'desc' },
      }),
      this.prisma.debtParticipant.findMany({
        where: { debtId: id },
        include: { driver: { select: { id: true, fullName: true } } },
        orderBy: { joinedAt: 'asc' },
      }),
      this.prisma.debtExpense.findMany({
        where: { debtId: id },
        include: { driver: { select: { id: true, fullName: true } } },
        orderBy: { spentAt: 'desc' },
      }),
    ]);
    return {
      ...this.shape(debt),
      summary: this.summarize(debt, payments),
      payments: payments.map(this.shapePayment),
      participants: parts.map((r) => ({
        driverId: r.driverId,
        name: r.driver?.fullName ?? 'Repartidor',
        joinedAt: r.joinedAt,
      })),
      expenses: expRows.map((r) => this.shapeExpense(r)),
      expenseSummary: this.summarizeExpenses(expRows),
    };
  }

  async create(data: {
    title: string;
    description?: string;
    totalAmount: number;
    monthlyAmount: number;
    downPayment?: number;
    startDate: string;
    termMonths?: number;
  }) {
    const title = String(data?.title ?? '')
      .trim()
      .slice(0, 120);
    const totalAmount = Number(data?.totalAmount);
    const monthlyAmount = Number(data?.monthlyAmount);
    const downPayment = data?.downPayment != null ? Number(data.downPayment) : 0;
    const startDate = new Date(data?.startDate);
    const termMonths = data?.termMonths != null ? Number(data.termMonths) : null;
    if (!title) throw new BadRequestException('El título es requerido');
    if (!Number.isFinite(totalAmount) || totalAmount <= 0)
      throw new BadRequestException('El monto total debe ser mayor a 0');
    if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0)
      throw new BadRequestException('La mensualidad debe ser mayor a 0');
    if (!Number.isFinite(downPayment) || downPayment < 0)
      throw new BadRequestException('La prima no puede ser negativa');
    if (downPayment >= totalAmount)
      throw new BadRequestException('La prima no puede cubrir el total (entonces no hay deuda)');
    if (Number.isNaN(startDate.getTime()))
      throw new BadRequestException('Fecha de inicio inválida');
    if (termMonths != null && (!Number.isInteger(termMonths) || termMonths <= 0))
      throw new BadRequestException('El plazo en meses debe ser un entero mayor a 0');
    const debt = await this.prisma.debt.create({
      data: {
        title,
        description:
          String(data?.description ?? '')
            .trim()
            .slice(0, 500) || null,
        totalAmount,
        monthlyAmount,
        downPayment,
        startDate,
        termMonths,
      },
    });
    return { ...this.shape(debt), summary: this.summarize(debt, []) };
  }

  async addPayment(
    debtId: string,
    data: { amount: number; kind?: string; driverId?: string; note?: string; paidAt?: string },
    createdBy?: string,
  ) {
    const debt = await this.prisma.debt.findUnique({ where: { id: debtId } });
    if (!debt) throw new NotFoundException('Deuda no encontrada');
    const amount = Number(data?.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      throw new BadRequestException('El monto debe ser mayor a 0');
    const kind = String(data?.kind ?? 'cuota');
    if (!(KINDS as readonly string[]).includes(kind))
      throw new BadRequestException('Tipo de pago inválido (cuota, aporte o extra)');
    let driverId: string | null = null;
    if (data?.driverId) {
      const driver = await this.prisma.driverProfile.findUnique({
        where: { id: String(data.driverId) },
        select: { id: true },
      });
      if (!driver) throw new NotFoundException('Repartidor no encontrado');
      driverId = driver.id;
    }
    let paidAt = new Date();
    if (data?.paidAt) {
      paidAt = new Date(data.paidAt);
      if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('Fecha inválida');
      if (paidAt.getTime() > Date.now() + 24 * 60 * 60 * 1000)
        throw new BadRequestException('La fecha no puede ser futura');
    }
    const payment = await this.prisma.debtPayment.create({
      data: {
        debtId,
        amount: Math.round(amount * 100) / 100,
        kind: kind as any,
        driverId,
        note:
          String(data?.note ?? '')
            .trim()
            .slice(0, 300) || null,
        paidAt,
        createdBy: createdBy ?? null,
      },
      include: { driver: { select: { id: true, fullName: true } } },
    });
    return this.shapePayment(payment);
  }

  async removePayment(debtId: string, paymentId: string) {
    const payment = await this.prisma.debtPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.debtId !== debtId) throw new NotFoundException('Pago no encontrado');
    await this.prisma.debtPayment.delete({ where: { id: paymentId } });
    return { ok: true };
  }

  /** Repartidores para el selector de aportes (id del perfil + nombre). */
  async drivers() {
    const list = await this.prisma.driverProfile.findMany({
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    });
    return list;
  }

  // ---- Participantes: quiénes pagan la deuda con sus viajes ----

  async participants(debtId: string) {
    await this.requireDebt(debtId);
    const rows = await this.prisma.debtParticipant.findMany({
      where: { debtId },
      include: { driver: { select: { id: true, fullName: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((r) => ({
      driverId: r.driverId,
      name: r.driver?.fullName ?? 'Repartidor',
      joinedAt: r.joinedAt,
    }));
  }

  async addParticipant(debtId: string, driverId: string) {
    await this.requireDebt(debtId);
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      select: { id: true },
    });
    if (!driver) throw new NotFoundException('Repartidor no encontrado');
    await this.prisma.debtParticipant.upsert({
      where: { debtId_driverId: { debtId, driverId } },
      update: {},
      create: { debtId, driverId },
    });
    return this.participants(debtId);
  }

  async removeParticipant(debtId: string, driverId: string) {
    await this.prisma.debtParticipant.deleteMany({ where: { debtId, driverId } });
    return this.participants(debtId);
  }

  // ---- Gastos: mantenimiento, seguro, gasolina, repuestos, marchamo ----

  private shapeExpense(e: any) {
    return {
      id: e.id,
      debtId: e.debtId,
      amount: Number(e.amount),
      kind: e.kind,
      driverId: e.driverId,
      driverName: e.driver?.fullName ?? null,
      note: e.note,
      spentAt: e.spentAt,
      createdAt: e.createdAt,
    };
  }

  async expenses(debtId: string) {
    await this.requireDebt(debtId);
    const rows = await this.prisma.debtExpense.findMany({
      where: { debtId },
      include: { driver: { select: { id: true, fullName: true } } },
      orderBy: { spentAt: 'desc' },
    });
    return {
      items: rows.map((r) => this.shapeExpense(r)),
      summary: this.summarizeExpenses(rows),
    };
  }

  /** Totales por tipo + gasolina hoy / últimos 7 días / este mes. */
  summarizeExpenses(rows: any[]) {
    const byKind: Record<string, number> = {};
    let fuelToday = 0;
    let fuelWeek = 0;
    let fuelMonth = 0;
    const now = new Date();
    const dayStart = startOfTodayCR(now);
    const weekStart = new Date(dayStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 6, 0, 0, 0));
    let total = 0;
    for (const e of rows) {
      const amt = this.toNum(e.amount);
      total = Math.round((total + amt) * 100) / 100;
      const k = String(e.kind ?? 'otro');
      byKind[k] = Math.round(((byKind[k] ?? 0) + amt) * 100) / 100;
      if (k === 'gasolina' && e.spentAt) {
        const d = new Date(e.spentAt);
        if (d >= dayStart) fuelToday = Math.round((fuelToday + amt) * 100) / 100;
        if (d >= weekStart) fuelWeek = Math.round((fuelWeek + amt) * 100) / 100;
        if (d >= monthStart) fuelMonth = Math.round((fuelMonth + amt) * 100) / 100;
      }
    }
    return { total: Math.round(total * 100) / 100, byKind, fuelToday, fuelWeek, fuelMonth };
  }

  async addExpense(
    debtId: string,
    data: { amount: number; kind?: string; driverId?: string; note?: string; spentAt?: string },
    createdBy?: string,
  ) {
    await this.requireDebt(debtId);
    const amount = Number(data?.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      throw new BadRequestException('El monto debe ser mayor a 0');
    const kind = String(data?.kind ?? 'otro');
    if (!(EXPENSE_KINDS as readonly string[]).includes(kind))
      throw new BadRequestException('Tipo de gasto inválido');
    let driverId: string | null = null;
    if (data?.driverId) {
      const driver = await this.prisma.driverProfile.findUnique({
        where: { id: String(data.driverId) },
        select: { id: true },
      });
      if (!driver) throw new NotFoundException('Repartidor no encontrado');
      driverId = driver.id;
    }
    let spentAt = new Date();
    if (data?.spentAt) {
      spentAt = new Date(data.spentAt);
      if (Number.isNaN(spentAt.getTime())) throw new BadRequestException('Fecha inválida');
      if (spentAt.getTime() > Date.now() + 24 * 60 * 60 * 1000)
        throw new BadRequestException('La fecha no puede ser futura');
    }
    const row = await this.prisma.debtExpense.create({
      data: {
        debtId,
        amount: Math.round(amount * 100) / 100,
        kind: kind as any,
        driverId,
        note:
          String(data?.note ?? '')
            .trim()
            .slice(0, 300) || null,
        spentAt,
        createdBy: createdBy ?? null,
      },
      include: { driver: { select: { id: true, fullName: true } } },
    });
    return this.shapeExpense(row);
  }

  async removeExpense(debtId: string, expenseId: string) {
    const row = await this.prisma.debtExpense.findUnique({ where: { id: expenseId } });
    if (!row || row.debtId !== debtId) throw new NotFoundException('Gasto no encontrado');
    await this.prisma.debtExpense.delete({ where: { id: expenseId } });
    return { ok: true };
  }

  private async requireDebt(debtId: string) {
    const debt = await this.prisma.debt.findUnique({ where: { id: debtId } });
    if (!debt) throw new NotFoundException('Deuda no encontrada');
    return debt;
  }

  private shape(d: any) {
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      totalAmount: Number(d.totalAmount),
      monthlyAmount: Number(d.monthlyAmount),
      downPayment: Number(d.downPayment ?? 0),
      startDate: d.startDate,
      termMonths: d.termMonths,
      createdAt: d.createdAt,
    };
  }

  private shapePayment(p: any) {
    return {
      id: p.id,
      debtId: p.debtId,
      amount: Number(p.amount),
      kind: p.kind,
      driverId: p.driverId,
      driverName: p.driver?.fullName ?? null,
      note: p.note,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    };
  }
}
