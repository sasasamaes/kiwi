import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Crédito prepago de comercios: el admin recarga, el comercio lo gasta en
 * envíos. Cada gasto = viaje (payout del repartidor) + comisión de la app.
 * Los productos los cobra el comercio aparte — nunca salen del crédito.
 * Todo movimiento queda en el libro mayor (credit_transactions).
 */
@Injectable()
export class CreditsService {
  constructor(private prisma: PrismaService) {}

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
            'Saldo insuficiente. Llamá a Kiwi para recargar tu crédito.',
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
