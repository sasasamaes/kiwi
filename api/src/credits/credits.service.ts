// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OnvoPayProvider } from '../payments/providers/onvopay.provider';

/** Recarga con tarjeta: paquetes desde ₡10.000 (misma política que admin). */
export const MIN_CARD_TOPUP = 10_000;
export const MAX_CARD_TOPUP = 1_000_000;

/**
 * Crédito prepago de comercios: el admin recarga, el comercio lo gasta en
 * envíos. Cada gasto = solo el viaje (el comercio no paga comisión: la paga
 * el repartidor desde su payout).
 * Los productos los cobra el comercio aparte — nunca salen del crédito.
 * Todo movimiento queda en el libro mayor (credit_transactions).
 * El comercio además puede autorecargarse con tarjeta (Onvo Checkout):
 * la fila credit_topups nace pendiente y solo acredita al confirmarse
 * el cobro (webhook o polling).
 */
@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    private prisma: PrismaService,
    private onvoPay: OnvoPayProvider,
  ) {}

  private async merchantOf(userId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { userId } });
    if (!merchant) throw new NotFoundException('Perfil de comerciante no encontrado');
    return merchant;
  }

  async getBalance(userId: string) {
    const merchant = await this.merchantOf(userId);
    return { merchantId: merchant.id, balance: Number(merchant.creditBalance) };
  }

  async getHistory(userId: string, take = 30, skip = 0) {
    const merchant = await this.merchantOf(userId);
    const t = Math.min(Math.max(Number(take) || 30, 1), 100);
    const s = Math.max(Number(skip) || 0, 0);
    const [total, items] = await Promise.all([
      this.prisma.creditTransaction.count({ where: { merchantId: merchant.id } }),
      this.prisma.creditTransaction.findMany({
        where: { merchantId: merchant.id },
        orderBy: { createdAt: 'desc' },
        take: t,
        skip: s,
      }),
    ]);
    return {
      balance: Number(merchant.creditBalance),
      total,
      items: items.map((i) => ({ ...i, amount: Number(i.amount) })),
    };
  }

  /** Recarga del admin: suma saldo y lo deja asentado. */
  async recharge(merchantId: string, amount: number, adminUserId: string, reason?: string) {
    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value <= 0 || value > 1000000) {
      throw new BadRequestException('Monto de recarga inválido (1–1,000,000)');
    }
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new NotFoundException('Comercio no encontrado');

    const [updated] = await this.prisma.$transaction([
      this.prisma.merchantProfile.update({
        where: { id: merchantId },
        data: { creditBalance: { increment: value } },
      }),
      this.prisma.creditTransaction.create({
        data: {
          merchantId,
          amount: value,
          kind: 'recharge',
          reason: reason || 'Recarga prepago',
          createdBy: adminUserId,
        },
      }),
    ]);
    return { merchantId, balance: Number(updated.creditBalance), recharged: value };
  }

  /**
   * Gasto atómico contra saldo: descuenta solo si alcanza. El monto del
   * gasto es viaje + comisión (lo calcula quien llama desde el pedido).
   * Si no alcanza, error claro para mostrar el mensaje de recarga.
   */
  async spend(merchantId: string, amount: number, orderId: string) {
    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException('Monto a gastar inválido');
    }
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const charged = await tx.merchantProfile.updateMany({
          where: { id: merchantId, creditBalance: { gte: value } },
          data: { creditBalance: { decrement: value } },
        });
        if (charged.count === 0) {
          throw new BadRequestException(
            'Saldo insuficiente. Recargá con tarjeta en Mi crédito o llamá a Kiwi.',
          );
        }
        const entry = await tx.creditTransaction.create({
          data: { merchantId, amount: -value, kind: 'spend', orderId, reason: 'Envío del pedido' },
        });
        const merchant = await tx.merchantProfile.findUnique({ where: { id: merchantId } });
        return { entry, balance: Number(merchant?.creditBalance ?? 0) };
      });
      return { spent: value, balance: result.balance };
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('No se pudo aplicar el gasto de crédito');
    }
  }

  /** Devolución del admin (ej. pedido cancelado con crédito). */
  async refund(merchantId: string, amount: number, adminUserId: string, reason?: string) {
    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException('Monto inválido');
    }
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new NotFoundException('Comercio no encontrado');
    const [updated] = await this.prisma.$transaction([
      this.prisma.merchantProfile.update({
        where: { id: merchantId },
        data: { creditBalance: { increment: value } },
      }),
      this.prisma.creditTransaction.create({
        data: {
          merchantId,
          amount: value,
          kind: 'refund',
          reason: reason || 'Devolución',
          createdBy: adminUserId,
        },
      }),
    ]);
    return { merchantId, balance: Number(updated.creditBalance), refunded: value };
  }

  /**
   * Autorecarga del comercio con tarjeta: crea la recarga pendiente y una
   * sesión de Onvo Checkout. El saldo se acredita SOLO cuando el cobro se
   * confirma (webhook `checkout-session.succeeded` o polling de estado).
   */
  async createTopup(userId: string, amount: number) {
    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value < MIN_CARD_TOPUP || value > MAX_CARD_TOPUP) {
      throw new BadRequestException(
        `Monto inválido: la recarga mínima con tarjeta es ₡${MIN_CARD_TOPUP.toLocaleString()}`,
      );
    }
    const merchant = await this.merchantOf(userId);
    const topup = await this.prisma.creditTopup.create({
      data: {
        merchantId: merchant.id,
        amount: value,
        currency: 'CRC',
        status: 'pending',
        createdBy: userId,
      },
    });

    // Retorno al panel del comercio (jamás relativo: Onvo lo exige).
    const merchantBase = (process.env.MERCHANT_URL ?? 'https://negocios.kiwicr.express').replace(
      /^http:\/\//i,
      'https://',
    );

    const session = await this.onvoPay.createCheckoutSession({
      amount: value,
      currency: 'CRC',
      description: `Recarga de crédito Kiwi — ${merchant.businessName} (₡${value.toLocaleString()})`,
      redirectUrl: `${merchantBase}/credits?topup=${topup.id}&paid=1`,
      cancelUrl: `${merchantBase}/credits?topup=${topup.id}&cancelled=1`,
      metadata: { topupId: topup.id },
    });
    if (!session.success || !session.checkoutUrl) {
      await this.prisma.creditTopup
        .update({ where: { id: topup.id }, data: { status: 'failed' } })
        .catch(() => null);
      throw new BadRequestException(session.error || 'No se pudo iniciar el pago con tarjeta');
    }

    const updated = await this.prisma.creditTopup.update({
      where: { id: topup.id },
      data: { onvoSessionId: session.sessionId, onvoCheckoutUrl: session.checkoutUrl },
    });
    return {
      topupId: updated.id,
      amount: value,
      checkoutUrl: session.checkoutUrl,
      status: updated.status,
    };
  }

  /**
   * Estado de una recarga (solo la dueña). Si sigue pendiente y tiene
   * sesión de Onvo, reconcilia contra Onvo antes de responder para no
   * mentir con filas viejas — igual que los pagos de pedidos.
   */
  async getTopup(userId: string, topupId: string) {
    const merchant = await this.merchantOf(userId);
    const topup = await this.prisma.creditTopup.findUnique({ where: { id: topupId } });
    if (!topup || topup.merchantId !== merchant.id) {
      throw new ForbiddenException('No tienes acceso a esta recarga');
    }
    if (topup.status === 'pending' && (topup as any).onvoSessionId) {
      await this.reconcileTopup(topup).catch((e) =>
        this.logger.warn(`Topup reconcile failed for ${topupId}: ${String(e)}`),
      );
      const fresh = await this.prisma.creditTopup.findUnique({ where: { id: topupId } });
      const balance = await this.merchantOf(userId);
      return this.shapeTopup(fresh ?? topup, Number(balance.creditBalance));
    }
    return this.shapeTopup(topup, Number(merchant.creditBalance));
  }

  /**
   * Acredita una recarga cobrada. Gate anti doble-acreditación: el
   * updateMany condicionado deja pasar a UNA sola carrera (webhook +
   * polling simultáneos). Devuelve true si esta llamada acreditó.
   */
  async completeTopup(topupId: string, paymentIntentId?: string): Promise<boolean> {
    const topup = await this.prisma.creditTopup.findUnique({ where: { id: topupId } });
    if (!topup) {
      this.logger.warn(`completeTopup for unknown topup ${topupId} — ignoring`);
      return false;
    }
    if ((topup as any).status === 'completed') return false;

    const claimed = await this.prisma.creditTopup.updateMany({
      where: { id: topupId, NOT: { status: 'completed' } },
      data: {
        status: 'completed',
        completedAt: new Date(),
        ...(paymentIntentId ? { onvoPaymentId: paymentIntentId } : {}),
      },
    });
    if (claimed.count === 0) return false;

    const amount = Math.round(Number((topup as any).amount));
    await this.recharge(
      (topup as any).merchantId,
      amount,
      (topup as any).createdBy ?? undefined,
      'Recarga con tarjeta (Onvo)',
    );
    this.logger.log(`Credit topup ${topupId} completed: +${amount}`);
    return true;
  }

  /** Completa por intent de Onvo (fallback cuando el webhook no trae topupId). */
  async completeTopupByIntent(paymentIntentId: string): Promise<boolean> {
    if (!paymentIntentId) return false;
    const topup = await this.prisma.creditTopup.findFirst({
      where: { onvoPaymentId: paymentIntentId },
    });
    if (!topup) return false;
    return this.completeTopup((topup as any).id, paymentIntentId);
  }

  /** Reconcilia una recarga pendiente contra Onvo (polling tras el retorno). */
  private async reconcileTopup(topup: any): Promise<void> {
    const session = await this.onvoPay.getCheckoutSession(topup.onvoSessionId);
    if (session.paymentIntentId && !topup.onvoPaymentId) {
      await this.prisma.creditTopup
        .update({ where: { id: topup.id }, data: { onvoPaymentId: session.paymentIntentId } })
        .catch(() => null);
      topup.onvoPaymentId = session.paymentIntentId;
    }
    const paid =
      session.paymentStatus === 'paid' ||
      session.status === 'complete' ||
      session.status === 'succeeded';
    const dead =
      session.status === 'expired' ||
      session.status === 'canceled' ||
      session.status === 'cancelled';
    if (paid) {
      await this.completeTopup(topup.id, session.paymentIntentId);
    } else if (dead) {
      await this.prisma.creditTopup
        .updateMany({ where: { id: topup.id, status: 'pending' }, data: { status: 'failed' } })
        .catch(() => null);
    }
  }

  private shapeTopup(topup: any, balance: number) {
    return {
      id: topup.id,
      amount: Number(topup.amount),
      currency: topup.currency ?? 'CRC',
      status: topup.status,
      checkoutUrl: topup.onvoCheckoutUrl ?? null,
      balance,
      completedAt: topup.completedAt ?? null,
    };
  }

  /** Admin: comercios con saldo + última recarga (para la cobranza semanal). */
  async listMerchants() {
    const merchants = await this.prisma.merchantProfile.findMany({
      orderBy: { businessName: 'asc' },
      select: {
        id: true,
        businessName: true,
        creditBalance: true,
        user: { select: { phone: true, email: true } },
      },
    });
    return merchants.map((m) => ({
      id: m.id,
      businessName: m.businessName,
      balance: Number(m.creditBalance),
      phone: (m.user as any)?.phone ?? null,
      email: (m.user as any)?.email ?? null,
    }));
  }

  async adminHistory(merchantId: string, take = 30, skip = 0) {
    const t = Math.min(Math.max(Number(take) || 30, 1), 100);
    const s = Math.max(Number(skip) || 0, 0);
    const [total, items] = await Promise.all([
      this.prisma.creditTransaction.count({ where: { merchantId } }),
      this.prisma.creditTransaction.findMany({
        where: { merchantId },
        orderBy: { createdAt: 'desc' },
        take: t,
        skip: s,
      }),
    ]);
    return { total, items: items.map((i) => ({ ...i, amount: Number(i.amount) })) };
  }
}
