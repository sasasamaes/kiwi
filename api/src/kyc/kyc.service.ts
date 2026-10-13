// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FieldCipher } from '../security/field-cipher';
import { DiditProvider } from './didit.provider';
import { mapDiditStatus, verifyDiditWebhook } from './didit.webhook';

@Injectable()
export class KYCService {
  private readonly logger = new Logger(KYCService.name);
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
    private didit: DiditProvider,
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
    return rows.map((r) => this.decryptIdentityFields(r, { mask: true }));
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
    return rows.map((r) => this.decryptIdentityFields(r, { mask: true }));
  }

  async getVerificationByUserId(userId: string, opts?: { maskIdentity?: boolean }) {
    const row = await this.prisma.kYCVerification.findUnique({
      where: { userId },
    });
    return this.decryptIdentityFields(row, { mask: opts?.maskIdentity ?? true });
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

      return this.decryptIdentityFields(updatedVerification, { mask: true });
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

      return this.decryptIdentityFields(rejected, { mask: true });
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

  // ============================================
  // 🤖 Didit hosted KYC
  // ============================================

  private assertDiditConfigured() {
    if (!this.didit.isConfigured()) {
      throw new BadRequestException(
        'Verificación automática no configurada. Subí tus documentos manualmente.',
      );
    }
  }

  /**
   * Crea (o reusa por vendor_data, según Didit) una sesión y devuelve la URL
   * hospedada. Nunca expone la API key: solo viajan url + session_id.
   */
  async startDiditSession(userId: string) {
    this.assertDiditConfigured();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driverProfile: true, merchantProfile: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const existing = await this.prisma.kYCVerification.findUnique({ where: { userId } });
    if (existing?.status === 'approved') {
      throw new BadRequestException('KYC ya está aprobado');
    }

    const fullName =
      (user as any).driverProfile?.fullName ??
      (user as any).merchantProfile?.businessName ??
      undefined;
    const [firstName, ...rest] = String(fullName ?? '')
      .trim()
      .split(/\s+/);
    const session = await this.didit.createSession({
      vendorData: userId,
      language: 'es',
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      firstName: firstName || undefined,
      lastName: rest.length > 0 ? rest.join(' ') : undefined,
    });

    const row = existing
      ? await this.prisma.kYCVerification.update({
          where: { userId },
          data: {
            diditSessionId: session.session_id,
            diditStatus: session.status,
            diditUrl: session.url,
          },
        })
      : await this.prisma.kYCVerification.create({
          data: {
            userId,
            status: 'pending',
            diditSessionId: session.session_id,
            diditStatus: session.status,
            diditUrl: session.url,
          },
        });
    return {
      url: session.url,
      sessionId: session.session_id,
      status: session.status,
      verificationId: row.id,
    };
  }

  /** Pull manual de la decisión (fallback si el webhook se perdió). */
  async refreshDiditSession(userId: string) {
    this.assertDiditConfigured();
    const verification = await this.prisma.kYCVerification.findUnique({ where: { userId } });
    if (!verification?.diditSessionId) {
      throw new BadRequestException('No hay sesión Didit para actualizar');
    }
    const decision = await this.didit.getDecision(verification.diditSessionId);
    return this.applyDiditDecision(verification.diditSessionId, decision?.status, decision);
  }

  /**
   * Aplica una decisión Didit (del webhook verificado o del pull manual).
   * Espeja approve/reject manual: perfiles + notificación, todo atómico.
   */
  async applyDiditDecision(sessionId: string, diditStatus: unknown, decision?: unknown) {
    const mapped = mapDiditStatus(diditStatus);
    if (!mapped) {
      throw new BadRequestException(`Estado Didit desconocido: ${String(diditStatus)}`);
    }
    const verification = await this.prisma.kYCVerification.findUnique({
      where: { diditSessionId: sessionId },
      include: { user: true },
    });
    if (!verification) {
      throw new NotFoundException('Sesión Didit no registrada');
    }
    if (verification.status === 'approved' && mapped === 'approved') {
      return this.decryptIdentityFields(verification, { mask: true });
    }

    const now = new Date();
    if (mapped === 'approved') {
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.kYCVerification.update({
          where: { id: verification.id },
          data: {
            status: 'approved',
            verifiedAt: now,
            verifiedBy: 'didit',
            diditStatus: String(diditStatus),
            diditVerifiedAt: now,
            rejectionReason: null,
          },
        });
        if (verification.user.role === 'driver') {
          await tx.driverProfile.update({
            where: { userId: verification.userId },
            data: { kycStatus: 'approved', kycVerifiedAt: now },
          });
        } else if (verification.user.role === 'merchant') {
          await tx.merchantProfile.update({
            where: { userId: verification.userId },
            data: { kycStatus: 'approved', kycVerifiedAt: now },
          });
        }
        await tx.notification.create({
          data: {
            userId: verification.userId,
            title: 'KYC Aprobado',
            body: 'Tu verificación de identidad fue aprobada. ¡Ya puedes usar la plataforma!',
            type: 'kyc_approved',
          },
        });
        return this.decryptIdentityFields(row, { mask: true });
      });
      return updated;
    }

    if (mapped === 'rejected') {
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.kYCVerification.update({
          where: { id: verification.id },
          data: {
            status: 'rejected',
            verifiedAt: now,
            verifiedBy: 'didit',
            diditStatus: String(diditStatus),
            rejectionReason:
              'Verificación automática rechazada. Revisá tus documentos e intentá de nuevo.',
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
            body: 'Tu verificación automática fue rechazada. Revisá tus documentos e intentá de nuevo.',
            type: 'kyc_rejected',
          },
        });
        return this.decryptIdentityFields(row, { mask: true });
      });
      return updated;
    }

    // under_review / pending / expired: solo se registra el estado Didit.
    return this.prisma.kYCVerification.update({
      where: { id: verification.id },
      data: { status: mapped as any, diditStatus: String(diditStatus) },
    });
  }

  /** Re-sincroniza una sesión Didit conocida (usado por `data.updated`). */
  private async refreshSessionByDiditId(sessionId: string) {
    if (!sessionId) return { ok: true, ignored: 'no-session' };
    const verification = await this.prisma.kYCVerification.findUnique({
      where: { diditSessionId: sessionId },
    });
    if (!verification) {
      this.logger.log(`Webhook Didit data.updated sin sesión local: ${sessionId}`);
      return { ok: true, ignored: 'unknown-session' };
    }
    const out: any = await this.refreshDiditSession(verification.userId);
    return { ok: true, refreshed: true, status: out?.status ?? null };
  }
  /**
   * Webhook Didit (público, firmado). Orden: firma → frescura → idempotencia
   * → dispatch. Rápido: aplica el payload verificado sin fetches extra, salvo
   * `data.updated` que re-sincroniza vía pull acotado.
   *
   * Familias (destination.subscribed_events, valores exactos):
   * status.updated, data.updated, user.status.updated, user.data.updated,
   * business.status.updated, business.data.updated, activity.created,
   * transaction.created, transaction.status.updated.
   */
  async handleDiditWebhook(signature: string, parsedBody: any, rawBody?: string | Buffer) {
    const secret = (process.env.DIDIT_WEBHOOK_SECRET || '').trim();
    const check = verifyDiditWebhook(secret, parsedBody, signature || '', rawBody);
    if (!check.ok) {
      // Sin PII del body: solo identificadores para correlacionar en logs.
      this.logger.warn(
        `Webhook Didit inválido: ${check.reason} ` +
          `event=${String((parsedBody as any)?.event_id || '?')} ` +
          `type=${String((parsedBody as any)?.webhook_type || '?')}`,
      );
      const err: any = new Error(`Webhook Didit inválido: ${check.reason}`);
      err.status = 401;
      throw err;
    }
    const eventId = String((parsedBody as any)?.event_id || '');
    if (!eventId) {
      const err: any = new Error('Webhook Didit sin event_id');
      err.status = 400;
      throw err;
    }
    try {
      await this.prisma.diditWebhookEvent.create({ data: { eventId } });
    } catch (e: any) {
      // P2002 = delivery duplicado (retry de Didit): ack sin reprocesar.
      if (e?.code === 'P2002') return { ok: true, duplicate: true };
      throw e;
    }

    const webhookType = String((parsedBody as any)?.webhook_type || '');
    if (webhookType !== 'status.updated') {
      // Didit manda la decisión manual del dashboard con otros tipos de
      // evento: si el body trae sesión + decisión, se procesa igual (misma
      // firma, frescura e idempotencia ya verificadas). Solo se ignora lo
      // que no trae decisión.
      // Solo sesiones de verificación (session_id) aplican decisiones.
      // Los eventos business/entity se registran sin cambios locales.
      const carriesDecision =
        typeof (parsedBody as any)?.session_id === 'string' &&
        ((parsedBody as any)?.status !== undefined || (parsedBody as any)?.decision !== undefined);
      if (!carriesDecision) {
        if (webhookType === 'data.updated') {
          // Datos re-editados en Didit: re-sincronizar vía pull acotado.
          return this.refreshSessionByDiditId(String((parsedBody as any)?.session_id || ''));
        }
        // Entidades (user.*/business.*), actividad y transacciones: sin
        // espejo local todavía — ack + log para visibilidad.
        this.logger.log(
          `Webhook Didit ${webhookType || '(sin tipo)'} registrado sin cambios locales event=${eventId}`,
        );
        return { ok: true, ignored: (parsedBody as any)?.webhook_type };
      }
      this.logger.log(
        `Webhook Didit no estándar procesado como decisión: type=${webhookType} event=${eventId}`,
      );
    }
    // KYB: las sesiones business traen business_session_id (+ session_kind).
    const sessionId = String(
      (parsedBody as any)?.session_id || (parsedBody as any)?.business_session_id || '',
    );
    const status = (parsedBody as any)?.status;
    if (!sessionId) return { ok: true, ignored: 'no-session' };

    // Vincular por session_id; fallback por vendor_data (= nuestro userId).
    let verification = await this.prisma.kYCVerification.findUnique({
      where: { diditSessionId: sessionId },
    });
    if (!verification && typeof (parsedBody as any)?.vendor_data === 'string') {
      const byVendor = await this.prisma.kYCVerification.findUnique({
        where: { userId: (parsedBody as any).vendor_data },
      });
      if (byVendor) {
        verification = await this.prisma.kYCVerification.update({
          where: { userId: (parsedBody as any).vendor_data },
          data: { diditSessionId: sessionId },
        });
      }
    }
    if (!verification) return { ok: true, ignored: 'unknown-session' };

    await this.applyDiditDecision(sessionId, status, (parsedBody as any)?.decision);
    return { ok: true, status };
  }
}
