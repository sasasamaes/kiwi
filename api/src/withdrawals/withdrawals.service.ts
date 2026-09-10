import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WithdrawalsService {
  constructor(private prisma: PrismaService) {}

  async getBalance(driverUserId: string) {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    // Calculate total earnings from completed orders
    const totalEarnings = await this.prisma.order.aggregate({
      where: {
        driverId: driverProfile.id,
        status: 'delivered',
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

    // Check KYC status
    if (driverProfile.kycStatus !== 'approved') {
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
          where: { driverId: driverProfile.id, status: 'delivered' },
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
      throw new BadRequestException('No tienes acceso a este retiro');
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
      throw new BadRequestException('No tienes acceso a este retiro');
    }

    if (withdrawal.status !== 'pending') {
      throw new BadRequestException('Solo puedes cancelar retiros pendientes');
    }

    return this.prisma.withdrawal.update({
      where: { id },
      data: { status: 'failed' },
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
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: { driver: true },
    });

    if (!withdrawal) {
      throw new NotFoundException('Retiro no encontrado');
    }

    if (withdrawal.status !== 'pending') {
      throw new BadRequestException('El retiro ya fue procesado');
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: 'processing',
        processedAt: new Date(),
        processedBy: adminUserId,
        transactionId,
      },
    });

    // Notify driver
    await this.prisma.notification.create({
      data: {
        userId: withdrawal.driver.userId,
        title: 'Retiro en Proceso',
        body: `Tu retiro de ₡${Number(withdrawal.amount).toLocaleString()} está siendo procesado`,
        type: 'withdrawal_processing',
        data: { withdrawalId: id },
      },
    });

    return updated;
  }

  async completeWithdrawal(id: string, transactionId: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: { driver: true },
    });

    if (!withdrawal) {
      throw new NotFoundException('Retiro no encontrado');
    }

    if (withdrawal.status !== 'processing') {
      throw new BadRequestException('El retiro no está en proceso');
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: 'completed',
        transactionId,
      },
    });

    // Notify driver
    await this.prisma.notification.create({
      data: {
        userId: withdrawal.driver.userId,
        title: 'Retiro Completado',
        body: `Tu retiro de ₡${Number(withdrawal.amount).toLocaleString()} fue completado exitosamente`,
        type: 'withdrawal_completed',
        data: { withdrawalId: id },
      },
    });

    return updated;
  }

  async rejectWithdrawal(id: string, adminUserId: string, reason: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: { driver: true },
    });

    if (!withdrawal) {
      throw new NotFoundException('Retiro no encontrado');
    }

    if (withdrawal.status !== 'pending') {
      throw new BadRequestException('El retiro ya fue procesado');
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectionReason: reason,
        processedAt: new Date(),
        processedBy: adminUserId,
      },
    });

    // Notify driver
    await this.prisma.notification.create({
      data: {
        userId: withdrawal.driver.userId,
        title: 'Retiro Rechazado',
        body: `Tu retiro de ₡${Number(withdrawal.amount).toLocaleString()} fue rechazado: ${reason}`,
        type: 'withdrawal_rejected',
        data: { withdrawalId: id, reason },
      },
    });

    return updated;
  }
}
