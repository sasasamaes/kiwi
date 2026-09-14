import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FieldCipher } from '../security/field-cipher';

@Injectable()
export class KYCService {
  /** Identity numbers: encrypted at rest (AES-256-GCM), masked for display. */
  private static readonly ENCRYPTED_FIELDS = ['idNumber', 'licenseNumber', 'taxId'] as const;

  /**
   * Document URL fields: stored as-is and later opened/rendered by the admin
   * panel, so they get the strictest content restriction — https-only, bounded
   * length, no data:/javascript: URIs. (Uploads don't exist yet: when a real
   * storage backend lands, these fields become server-generated URLs only.)
   */
  private static readonly URL_FIELDS = [
    'idFrontUrl',
    'idBackUrl',
    'selfieUrl',
    'licenseUrl',
    'vehicleRegisterUrl',
    'insuranceUrl',
    'businessLicenseUrl',
  ] as const;

  constructor(
    private prisma: PrismaService,
    private cipher: FieldCipher,
  ) {}

  /** https-only, ≤512 chars, no embedded credentials or non-web schemes. */
  private static isAllowedDocumentUrl(value: unknown): value is string {
    if (typeof value !== 'string' || value.length === 0 || value.length > 512) return false;
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize document URLs: anything not passing the check is DROPPED (not
   * thrown) so a single bad field never blocks a legitimate resubmission of
   * the rest of the documents.
   */
  private sanitizeDocumentUrls<T extends Record<string, any>>(data: T): T {
    const out: any = { ...data };
    for (const field of KYCService.URL_FIELDS) {
      if (out[field] !== undefined && !KYCService.isAllowedDocumentUrl(out[field])) {
        delete out[field];
      }
    }
    return out;
  }

  /** Mask a plaintext identity number for safe display: keep last 4. */
  private static mask(value: string | null | undefined): string | null {
    if (!value) return null;
    const tail = value.slice(-4);
    return `••••${tail.replace(/[^0-9A-Za-z]/g, '') || '••••'}`;
  }

  /** Encrypt identity numbers before they hit the database. */
  private encryptIdentityFields<T extends Record<string, any>>(data: T): T {
    const out: any = { ...data };
    for (const field of KYCService.ENCRYPTED_FIELDS) {
      if (typeof out[field] === 'string' && out[field].length > 0) {
        out[field] = this.cipher.encrypt(out[field]);
      }
    }
    return out;
  }

  /** Decrypt (or mask) identity numbers coming out of the database. */
  private decryptIdentityFields(row: any, { mask }: { mask: boolean }): any {
    if (!row) return row;
    const out = { ...row };
    for (const field of KYCService.ENCRYPTED_FIELDS) {
      const v = out[field];
      if (typeof v === 'string' && v.length > 0 && this.cipher.isEncrypted(v)) {
        const plain = this.cipher.decrypt(v);
        out[field] = mask ? KYCService.mask(plain) : plain;
      } else if (typeof v === 'string' && v.length > 0) {
        // Legacy plaintext row (pre-cipher): NEVER echoed back unmasked, whoever
        // asks — display of full numbers requires the value to be encrypted.
        out[field] = KYCService.mask(v);
      }
    }
    return out;
  }

  async getPendingVerifications() {
    const rows = await this.prisma.kYCVerification.findMany({
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
    return rows.map((r) => this.decryptIdentityFields(r, { mask: false }));
  }

  async getAllVerifications(status?: string) {
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const rows = await this.prisma.kYCVerification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.decryptIdentityFields(r, { mask: false }));
  }

  async getVerificationByUserId(userId: string, opts?: { maskIdentity?: boolean }) {
    const row = await this.prisma.kYCVerification.findUnique({
      where: { userId },
    });
    return this.decryptIdentityFields(row, { mask: opts?.maskIdentity ?? false });
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

    return this.decryptIdentityFields(verification, { mask: false });
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

    // Identity numbers never touch the database unencrypted (AES-256-GCM),
    // document URLs only ever stored when https and bounded.
    const storedData = this.sanitizeDocumentUrls(this.encryptIdentityFields(cleanData));

    if (existing && existing.status === 'rejected') {
      // Allow resubmission after rejection
      return this.prisma.kYCVerification.update({
        where: { userId },
        data: {
          ...storedData,
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
          ...storedData,
          status: 'documents_submitted',
        },
      });
    }

    // Create new verification
    return this.prisma.kYCVerification.create({
      data: {
        userId,
        ...storedData,
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

      return this.decryptIdentityFields(updatedVerification, { mask: false });
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

      return this.decryptIdentityFields(rejected, { mask: false });
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
