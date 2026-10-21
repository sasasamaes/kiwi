// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const KINDS = ['cuota', 'aporte', 'extra'] as const;

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
          ? new Date(new Date().getFullYear(), new Date().getMonth() + monthsLeft, 1).toISOString()
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
    const payments = await this.prisma.debtPayment.findMany({
      where: { debtId: id },
      include: { driver: { select: { id: true, fullName: true } } },
      orderBy: { paidAt: 'desc' },
    });
    return {
      ...this.shape(debt),
      summary: this.summarize(debt, payments),
      payments: payments.map(this.shapePayment),
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
