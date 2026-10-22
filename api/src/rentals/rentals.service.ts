// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isRentalsEnabled } from '../feature-flags/feature-flags';

/**
 * Prueba de alquiler de motos a repartidores (FASE TEST, apagado por flag).
 * Contrato = precio semanal + depósito + vigencia; los pagos se registran
 * acá como libro aparte (no toca planilla ni retiros). Sin RENTALS_ENABLED=true
 * todo responde 403: el negocio lo activa cuando quiera testearlo en serio.
 */
@Injectable()
export class RentalsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireEnabled() {
    if (!isRentalsEnabled())
      throw new ForbiddenException(
        'Alquileres desactivado (fase test). Activá RENTALS_ENABLED=true para usarlo.',
      );
  }

  status() {
    return { enabled: isRentalsEnabled() };
  }

  private toNum(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private summarize(contract: any, payments: any[]) {
    const paid = payments.reduce((s, p) => s + this.toNum(p.amount), 0);
    const start = new Date(contract.startDate).getTime();
    const end = contract.endDate ? new Date(contract.endDate).getTime() : Date.now();
    const weeks = Math.max(0, Math.floor((end - start) / (7 * 24 * 60 * 60 * 1000)));
    const weekly = this.toNum(contract.weeklyPrice);
    // Semanas completas transcurridas × precio: lo que debería llevar pago.
    const expected = Math.round(weeks * weekly * 100) / 100;
    const due = Math.max(0, Math.round((expected - paid) * 100) / 100);
    return {
      paid: Math.round(paid * 100) / 100,
      weeksElapsed: weeks,
      expected,
      due,
    };
  }

  private shapeContract(c: any, payments: any[] = []) {
    return {
      id: c.id,
      debtId: c.debtId,
      debtTitle: c.debt?.title ?? null,
      driverId: c.driverId,
      driverName: c.driver?.fullName ?? 'Repartidor',
      weeklyPrice: Number(c.weeklyPrice),
      deposit: Number(c.deposit ?? 0),
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
      notes: c.notes,
      createdAt: c.createdAt,
      summary: this.summarize(c, payments),
    };
  }

  async contracts() {
    this.requireEnabled();
    const rows = await this.prisma.rentalContract.findMany({
      include: {
        driver: { select: { id: true, fullName: true } },
        debt: { select: { id: true, title: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((c) => this.shapeContract(c, c.payments));
  }

  async detail(id: string) {
    this.requireEnabled();
    const c = await this.prisma.rentalContract.findUnique({
      where: { id },
      include: {
        driver: { select: { id: true, fullName: true } },
        debt: { select: { id: true, title: true } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!c) throw new NotFoundException('Contrato no encontrado');
    return {
      ...this.shapeContract(c, c.payments),
      payments: c.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paidAt: p.paidAt,
        note: p.note,
        createdAt: p.createdAt,
      })),
    };
  }

  async create(data: {
    driverId: string;
    debtId?: string;
    weeklyPrice: number;
    deposit?: number;
    startDate: string;
    notes?: string;
  }) {
    this.requireEnabled();
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: String(data?.driverId) },
      select: { id: true },
    });
    if (!driver) throw new NotFoundException('Repartidor no encontrado');
    const active = await this.prisma.rentalContract.findFirst({
      where: { driverId: driver.id, status: 'active' },
      select: { id: true },
    });
    if (active) throw new BadRequestException('Ese repartidor ya tiene un alquiler activo');
    const weeklyPrice = Number(data?.weeklyPrice);
    if (!Number.isFinite(weeklyPrice) || weeklyPrice <= 0)
      throw new BadRequestException('El precio semanal debe ser mayor a 0');
    const deposit = data?.deposit != null ? Number(data.deposit) : 0;
    if (!Number.isFinite(deposit) || deposit < 0)
      throw new BadRequestException('El depósito no puede ser negativo');
    let debtId: string | null = null;
    if (data?.debtId) {
      const debt = await this.prisma.debt.findUnique({
        where: { id: String(data.debtId) },
        select: { id: true },
      });
      if (!debt) throw new NotFoundException('Deuda no encontrada');
      debtId = debt.id;
    }
    const startDate = new Date(data?.startDate);
    if (Number.isNaN(startDate.getTime()))
      throw new BadRequestException('Fecha de inicio inválida');
    const created = await this.prisma.rentalContract.create({
      data: {
        driverId: driver.id,
        debtId,
        weeklyPrice: Math.round(weeklyPrice * 100) / 100,
        deposit: Math.round(deposit * 100) / 100,
        startDate,
        notes:
          String(data?.notes ?? '')
            .trim()
            .slice(0, 300) || null,
      },
      include: {
        driver: { select: { id: true, fullName: true } },
        debt: { select: { id: true, title: true } },
        payments: true,
      },
    });
    return this.shapeContract(created, created.payments);
  }

  async close(id: string, status: 'finished' | 'cancelled') {
    this.requireEnabled();
    const c = await this.prisma.rentalContract.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Contrato no encontrado');
    if (c.status !== 'active') throw new BadRequestException('El contrato ya está cerrado');
    const updated = await this.prisma.rentalContract.update({
      where: { id },
      data: { status, endDate: new Date() },
      include: {
        driver: { select: { id: true, fullName: true } },
        debt: { select: { id: true, title: true } },
        payments: true,
      },
    });
    return this.shapeContract(updated, updated.payments);
  }

  async addPayment(
    contractId: string,
    data: { amount: number; paidAt?: string; note?: string },
    createdBy?: string,
  ) {
    this.requireEnabled();
    const c = await this.prisma.rentalContract.findUnique({ where: { id: contractId } });
    if (!c) throw new NotFoundException('Contrato no encontrado');
    const amount = Number(data?.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      throw new BadRequestException('El monto debe ser mayor a 0');
    let paidAt = new Date();
    if (data?.paidAt) {
      paidAt = new Date(data.paidAt);
      if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('Fecha inválida');
      if (paidAt.getTime() > Date.now() + 24 * 60 * 60 * 1000)
        throw new BadRequestException('La fecha no puede ser futura');
    }
    const payment = await this.prisma.rentalPayment.create({
      data: {
        contractId,
        amount: Math.round(amount * 100) / 100,
        paidAt,
        note:
          String(data?.note ?? '')
            .trim()
            .slice(0, 300) || null,
        createdBy: createdBy ?? null,
      },
    });
    return {
      id: payment.id,
      amount: Number(payment.amount),
      paidAt: payment.paidAt,
      note: payment.note,
      createdAt: payment.createdAt,
    };
  }

  async removePayment(contractId: string, paymentId: string) {
    this.requireEnabled();
    const payment = await this.prisma.rentalPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.contractId !== contractId)
      throw new NotFoundException('Pago no encontrado');
    await this.prisma.rentalPayment.delete({ where: { id: paymentId } });
    return { ok: true };
  }
}
