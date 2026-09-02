import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KycService {
  constructor(private prisma: PrismaService) {}

  async getKycStatus(userId: string) {
    const kyc = await this.prisma.kYCVerification.findUnique({
      where: { userId },
    });

    if (!kyc) {
      return {
        status: 'pending',
        message: 'No has iniciado la verificación',
      };
    }

    return kyc;
  }

  async submitDocuments(userId: string, data: any) {
    // Check if KYC already exists
    const existingKyc = await this.prisma.kYCVerification.findUnique({
      where: { userId },
    });

    if (existingKyc && existingKyc.status === 'approved') {
      throw new BadRequestException('Tu cuenta ya está verificada');
    }

    if (existingKyc && existingKyc.status === 'under_review') {
      throw new BadRequestException('Tus documentos están en revisión');
    }

    // Create or update KYC
    const kycData = {
      userId,
      status: 'documents_submitted' as any,
      idType: data.idType,
      idNumber: data.idNumber,
      idFrontUrl: data.idFrontUrl,
      idBackUrl: data.idBackUrl,
      selfieUrl: data.selfieUrl,
      // Driver specific
      licenseNumber: data.licenseNumber,
      licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : null,
      licenseUrl: data.licenseUrl,
      vehicleRegisterUrl: data.vehicleRegisterUrl,
      insuranceUrl: data.insuranceUrl,
      // Merchant specific
      businessLicenseUrl: data.businessLicenseUrl,
      taxId: data.taxId,
    };

    if (existingKyc) {
      return this.prisma.kYCVerification.update({
        where: { userId },
        data: kycData,
      });
    }

    return this.prisma.kYCVerification.create({
      data: kycData,
    });
  }

  async updateStatus(userId: string, status: string, notes?: string, rejectionReason?: string) {
    const kyc = await this.prisma.kYCVerification.findUnique({
      where: { userId },
    });

    if (!kyc) {
      throw new NotFoundException('KYC no encontrado');
    }

    const updateData: any = {
      status: status as any,
      notes,
      rejectionReason,
    };

    if (status === 'approved') {
      updateData.verifiedAt = new Date();
      updateData.verifiedBy = 'system'; // In real app, use admin ID

      // Update user's KYC status
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          merchantProfile: true,
          driverProfile: true,
        },
      });

      if (user?.merchantProfile) {
        await this.prisma.merchantProfile.update({
          where: { userId },
          data: {
            kycStatus: 'approved',
            kycVerifiedAt: new Date(),
          },
        });
      } else if (user?.driverProfile) {
        await this.prisma.driverProfile.update({
          where: { userId },
          data: {
            kycStatus: 'approved',
            kycVerifiedAt: new Date(),
          },
        });
      }
    }

    return this.prisma.kYCVerification.update({
      where: { userId },
      data: updateData,
    });
  }

  async getPendingVerifications() {
    return this.prisma.kYCVerification.findMany({
      where: {
        status: {
          in: ['documents_submitted', 'under_review'],
        },
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
}
