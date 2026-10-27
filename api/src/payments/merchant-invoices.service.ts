// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  payWeekStart,
  lastClosedWeek,
  payWeekStartFromISO,
} from '../withdrawals/withdrawals.service';

const WEEK_MS = 7 * 24 * 3600 * 1000;

export interface InvoiceLine {
  paymentId: string;
  orderId: string;
  deliveredAt: Date | null;
  pickupAddress: string;
  deliveryAddress: string;
  distanceKm: number | null;
  driverName: string | null;
  amount: number;
}

/**
 * Corte semanal de facturación pospago por comercio (pedidos con pago
 * weekly_invoice ya entregados). Semana mar–lun CR, igual corte que la
 * planilla de repartidores. Idempotente: (merchantId, periodStart) único y
 * las líneas se reclaman solo si invoiceId es null.
 */
@Injectable()
export class MerchantInvoicesService {
  constructor(private prisma: PrismaService) {}

  private weekRange(week?: string): { weekStart: Date; weekEnd: Date } {
    if (week) {
      const weekStart = payWeekStartFromISO(week);
      return { weekStart, weekEnd: new Date(weekStart.getTime() + WEEK_MS) };
    }
    return lastClosedWeek();
  }

  private async candidateLines(merchantId: string, weekStart: Date, weekEnd: Date) {
    const rows: any[] = await this.prisma.payment.findMany({
      where: {
        method: 'weekly_invoice' as any,
        status: 'completed' as any,
        invoiceId: null,
        order: {
          merchantId,
          status: 'delivered' as any,
          deliveredAt: { gte: weekStart, lt: weekEnd },
          // Los pedidos de prueba no se facturan al comercio.
          isTest: false,
        },
      },
      include: {
        order: {
          select: {
            id: true,
            deliveredAt: true,
            pickupAddress: true,
            deliveryAddress: true,
            distanceKm: true,
            driver: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((p): InvoiceLine => ({
      paymentId: p.id,
      orderId: p.orderId,
      deliveredAt: p.order?.deliveredAt ?? null,
      pickupAddress: String(p.order?.pickupAddress ?? ''),
      deliveryAddress: String(p.order?.deliveryAddress ?? ''),
      distanceKm: p.order?.distanceKm != null ? Number(p.order.distanceKm) : null,
      driverName: p.order?.driver?.fullName ?? null,
      amount: Math.round(Number(p.amount ?? 0)),
    }));
  }

  private shape(invoice: any, lines: InvoiceLine[] = []) {
    return {
      id: invoice.id,
      merchantId: invoice.merchantId,
      merchantName: invoice.merchant?.businessName ?? null,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      trips: invoice.trips,
      amount: Math.round(Number(invoice.amount ?? 0)),
      status: invoice.status,
      paidAt: invoice.paidAt ?? null,
      createdBy: invoice.createdBy ?? null,
      createdAt: invoice.createdAt,
      lines,
    };
  }

  /** Vista previa del corte: viajes pendientes de facturar + totales. */
  async preview(merchantId: string, week?: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantId },
      select: { id: true, businessName: true },
    });
    if (!merchant) throw new NotFoundException('Comercio no encontrado');
    const { weekStart, weekEnd } = this.weekRange(week);
    const lines = await this.candidateLines(merchantId, weekStart, weekEnd);
    return {
      merchantId,
      merchantName: merchant.businessName,
      periodStart: weekStart,
      periodEnd: weekEnd,
      trips: lines.length,
      amount: lines.reduce((s, l) => s + l.amount, 0),
      lines,
    };
  }

  /** Genera el corte (recibo) de la semana. Re-ejecutable sin duplicar. */
  async generate(adminUserId: string, merchantId: string, week?: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantId },
      select: { id: true, businessName: true },
    });
    if (!merchant) throw new NotFoundException('Comercio no encontrado');
    const { weekStart, weekEnd } = this.weekRange(week);

    const lines = await this.candidateLines(merchantId, weekStart, weekEnd);
    if (lines.length === 0) {
      // Reintento tras corte ya generado: devolverlo en vez de error vacío.
      const existing: any = await (this.prisma as any).merchantInvoice.findUnique({
        where: {
          merchant_invoices_merchant_period_uk: { merchantId, periodStart: weekStart },
        },
        include: { merchant: { select: { businessName: true } } },
      });
      if (existing) return this.detail(existing.id);
      throw new BadRequestException('No hay viajes pendientes de facturar en esa semana');
    }

    const amount = lines.reduce((s, l) => s + l.amount, 0);
    try {
      const created: any = await this.prisma.$transaction(async (tx: any) => {
        const invoice = await tx.merchantInvoice.create({
          data: {
            merchantId,
            periodStart: weekStart,
            periodEnd: weekEnd,
            trips: lines.length,
            amount,
            createdBy: adminUserId,
          },
        });
        // Reclamo de líneas: solo las aún sueltas. Si un corte concurrente
        // las tomó, count < lines.length y se revierte todo.
        const linked = await tx.payment.updateMany({
          where: {
            id: { in: lines.map((l) => l.paymentId) },
            invoiceId: null,
            status: 'completed',
          },
          data: { invoiceId: invoice.id },
        });
        if (linked.count !== lines.length) {
          throw new BadRequestException('Los viajes ya fueron facturados en otro corte');
        }
        return invoice;
      });
      return this.detail(created.id);
    } catch (e: any) {
      // Carrera: otro admin generó el mismo período a la vez.
      if (e?.code === 'P2002') {
        const existing: any = await (this.prisma as any).merchantInvoice.findUnique({
          where: {
            merchant_invoices_merchant_period_uk: { merchantId, periodStart: weekStart },
          },
        });
        if (existing) return this.detail(existing.id);
      }
      throw e;
    }
  }

  /** Marca el recibo como cobrado (solo pending → paid). */
  async markPaid(adminUserId: string, invoiceId: string) {
    const marked: any = await (this.prisma as any).merchantInvoice.updateMany({
      where: { id: invoiceId, status: 'pending' },
      data: { status: 'paid', paidAt: new Date() },
    });
    if (marked.count === 0) {
      const existing = await (this.prisma as any).merchantInvoice.findUnique({
        where: { id: invoiceId },
      });
      if (!existing) throw new NotFoundException('Factura no encontrada');
      throw new BadRequestException('La factura ya está cobrada');
    }
    return this.detail(invoiceId);
  }

  /** Listado admin con filtros por comercio/estado. */
  async listForAdmin(opts: { merchantId?: string; status?: string; take?: number; skip?: number }) {
    const take = Math.min(Math.max(Number(opts.take ?? 30), 1), 100);
    const skip = Math.max(Number(opts.skip ?? 0), 0);
    const where: any = {};
    if (opts.merchantId) where.merchantId = opts.merchantId;
    if (opts.status) {
      if (!['pending', 'paid'].includes(opts.status)) {
        throw new BadRequestException(`status inválido: ${opts.status}`);
      }
      where.status = opts.status;
    }
    const [total, rows, pending] = await Promise.all([
      (this.prisma as any).merchantInvoice.count({ where }),
      (this.prisma as any).merchantInvoice.findMany({
        where,
        include: { merchant: { select: { businessName: true } } },
        orderBy: { periodStart: 'desc' },
        take,
        skip,
      }),
      (this.prisma as any).merchantInvoice.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { status: 'pending' },
      }),
    ]);
    return {
      total,
      items: rows.map((r: any) => this.shape(r)),
      summary: {
        pendingCount: pending._count?.id ?? 0,
        pendingAmount: Math.round(Number(pending._sum?.amount ?? 0)),
      },
    };
  }

  /** Recibos del propio comercio (dueño). */
  async listForMerchant(merchantId: string, take = 30, skip = 0) {
    const rows: any[] = await (this.prisma as any).merchantInvoice.findMany({
      where: { merchantId },
      include: { merchant: { select: { businessName: true } } },
      orderBy: { periodStart: 'desc' },
      take: Math.min(Math.max(take, 1), 100),
      skip: Math.max(skip, 0),
    });
    return { items: rows.map((r: any) => this.shape(r)) };
  }

  /** Recibo con sus líneas; el comercio solo ve los suyos. */
  async detail(invoiceId: string, merchantId?: string) {
    const invoice: any = await (this.prisma as any).merchantInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        merchant: { select: { businessName: true } },
        payments: {
          include: {
            order: {
              select: {
                id: true,
                deliveredAt: true,
                pickupAddress: true,
                deliveryAddress: true,
                distanceKm: true,
                driver: { select: { fullName: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    if (merchantId && invoice.merchantId !== merchantId) {
      throw new ForbiddenException('No tienes acceso a esta factura');
    }
    const lines: InvoiceLine[] = (invoice.payments ?? []).map((p: any): InvoiceLine => ({
      paymentId: p.id,
      orderId: p.orderId,
      deliveredAt: p.order?.deliveredAt ?? null,
      pickupAddress: String(p.order?.pickupAddress ?? ''),
      deliveryAddress: String(p.order?.deliveryAddress ?? ''),
      distanceKm: p.order?.distanceKm != null ? Number(p.order.distanceKm) : null,
      driverName: p.order?.driver?.fullName ?? null,
      amount: Math.round(Number(p.amount ?? 0)),
    }));
    return this.shape(invoice, lines);
  }
}
