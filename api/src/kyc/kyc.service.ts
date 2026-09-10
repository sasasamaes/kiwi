import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KYCService {
  constructor(private prisma: PrismaService) {}

  async getPendingVerifications() {
    return this.prisma.kYCVerification.findMany({
      where: {
        status: { in: ['pending', 'documents_submitted', 'under_review'] },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getAllVerifications(status?: string) {
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    return this.prisma.kYCVerification.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getVerificationByUserId(userId: string) {
    return this.prisma.kYCVerification.findUnique({
      where: { userId },
    });
  }

  async getVerificationById(id: string) {
    const verification = await this.prisma.kYCVerification.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    if (!verification) {
      throw new NotFoundException('Verificación no encontrada');
    }

    return verification;
  }

  async submitDocuments(
    userId: string,
    data: {
      idType?: string;
      idNumber?: string;
      idFrontUrl?: string;
      idBackUrl?: string;
      selfieUrl?: string;
      licenseNumber?: string;
      licenseExpiry?: string;
      licenseUrl?: string;
      vehicleRegisterUrl?: string;
      insuranceUrl?: string;
      businessLicenseUrl?: string;
      taxId?: string;
    },
  ) {
    // Check if verification already exists
    const existing = await this.prisma.kYCVerification.findUnique({
      where: { userId },
    });

    if (existing && existing.status === 'approved') {
      throw new BadRequestException('KYC ya está aprobado');
    }

    const {
      idType,
      idNumber,
      idFrontUrl,
      idBackUrl,
      selfieUrl,
      licenseNumber,
      licenseExpiry,
      licenseUrl,
      vehicleRegisterUrl,
      insuranceUrl,
      businessLicenseUrl,
      taxId,
    } = data;

    const cleanData: any = {
      idType,
      idNumber,
      idFrontUrl,
      idBackUrl,
      selfieUrl,
      licenseNumber,
      licenseUrl,
      vehicleRegisterUrl,
      insuranceUrl,
      businessLicenseUrl,
      taxId,
    };
    // Remove undefined so Prisma doesn't choke, parse date explicitly
    Object.keys(cleanData).forEach((k) => cleanData[k] === undefined && delete cleanData[k]);
    if (licenseExpiry) {
      const parsed = new Date(licenseExpiry);
      if (!isNaN(parsed.getTime())) cleanData.licenseExpiry = parsed;
    }

    if (existing && existing.status === 'rejected') {
      // Allow resubmission after rejection
      return this.prisma.kYCVerification.update({
        where: { userId },
        data: {
          ...cleanData,
          status: 'documents_submitted',
          rejectionReason: null,
        },
      });
    }

    if (existing) {
      // Update pending/in-progress verification instead of crashing with P2002
      return this.prisma.kYCVerification.update({
        where: { userId },
        data: {
          ...cleanData,
          status: 'documents_submitted',
        },
      });
    }

    // Create new verification
    return this.prisma.kYCVerification.create({
      data: {
        userId,
        ...cleanData,
        status: 'documents_submitted',
      },
    });
  }

  async approveVerification(id: string, adminUserId: string) {
    const verification = await this.prisma.kYCVerification.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!verification) {
      throw new NotFoundException('Verificación no encontrada');
    }

    if (verification.status === 'approved') {
      throw new BadRequestException('La verificación ya está aprobada');
    }

    // Update KYC status
    const userRole = verification.user.role;
    const verificationUserId = verification.userId;
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedVerification = await tx.kYCVerification.update({
        where: { id },
        data: {
          status: 'approved',
          verifiedAt: new Date(),
          verifiedBy: adminUserId,
        },
      });

      // Update user's KYC status in profile (same tx: no verification
      // without profile update, and P2025 aborts both instead of half-state)
      if (userRole === 'driver') {
        await tx.driverProfile.update({
          where: { userId: verificationUserId },
          data: { kycStatus: 'approved', kycVerifiedAt: new Date() },
        });
      } else if (userRole === 'merchant') {
        await tx.merchantProfile.update({
          where: { userId: verificationUserId },
          data: { kycStatus: 'approved', kycVerifiedAt: new Date() },
        });
      }

      await tx.notification.create({
        data: {
          userId: verificationUserId,
          title: 'KYC Aprobado',
          body: 'Tu verificación de identidad fue aprobada. ¡Ya puedes usar la plataforma!',
          type: 'kyc_approved',
        },
      });

      return updatedVerification;
    });

    return updated;
  }

  async rejectVerification(id: string, adminUserId: string, reason: string) {
    const verification = await this.prisma.kYCVerification.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!verification) {
      throw new NotFoundException('Verificación no encontrada');
    }

    if (verification.status === 'rejected') {
      throw new BadRequestException('La verificación ya fue rechazada');
    }

    // Update KYC status + profile + notification atomically (mirror approve)
    const updated = await this.prisma.$transaction(async (tx) => {
      const rejected = await tx.kYCVerification.update({
        where: { id },
        data: {
          status: 'rejected',
          rejectionReason: reason,
          verifiedAt: new Date(),
          verifiedBy: adminUserId,
        },
      });

      if (verification.user.role === 'driver') {
        await tx.driverProfile.update({
          where: { userId: verification.userId },
          data: { kycStatus: 'rejected' },
        });
      } else if (verification.user.role === 'merchant') {
        await tx.merchantProfile.update({
          where: { userId: verification.userId },
          data: { kycStatus: 'rejected' },
        });
      }

      await tx.notification.create({
        data: {
          userId: verification.userId,
          title: 'KYC Rechazado',
          body: `Tu verificación fue rechazada: ${reason}. Por favor, sube los documentos correctos.`,
          type: 'kyc_rejected',
          data: { reason },
        },
      });

      return rejected;
    });

    return updated;
  }

  async getVerificationStats() {
    const [total, pending, approved, rejected] = await Promise.all([
      this.prisma.kYCVerification.count(),
      this.prisma.kYCVerification.count({
        where: { status: { in: ['pending', 'documents_submitted', 'under_review'] } },
      }),
      this.prisma.kYCVerification.count({ where: { status: 'approved' } }),
      this.prisma.kYCVerification.count({ where: { status: 'rejected' } }),
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
    };
  }
}
