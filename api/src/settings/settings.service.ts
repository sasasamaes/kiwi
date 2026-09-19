import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PlatformSettings {
  platform: {
    name: string;
    commission: number;
    minimumOrder: number;
    maximumDeliveryDistance: number;
    freeDeliveryThreshold: number;
  };
  payments: {
    sinpeEnabled: boolean;
    cardEnabled: boolean;
    cashEnabled: boolean;
    cryptoEnabled: boolean;
    cryptoWallet: string;
    payoutSchedule: string;
    minimumPayout: number;
  };
  notifications: {
    newOrder: boolean;
    orderAccepted: boolean;
    orderStatus: boolean;
    payment: boolean;
    rating: boolean;
    promotion: boolean;
  };
  security: {
    requireKYC: boolean;
    requirePhoneVerification: boolean;
    twoFactorAuth: boolean;
    sessionTimeout: number;
  };
}

/** Valores con los que nace la plataforma (y fallback si algo falta). */
export const DEFAULT_SETTINGS: PlatformSettings = {
  platform: {
    name: 'Kiwi',
    commission: 10,
    minimumOrder: 2000,
    maximumDeliveryDistance: 20,
    freeDeliveryThreshold: 10000,
  },
  payments: {
    sinpeEnabled: true,
    cardEnabled: true,
    cashEnabled: true,
    cryptoEnabled: true,
    cryptoWallet: '',
    payoutSchedule: 'weekly',
    minimumPayout: 5000,
  },
  notifications: {
    newOrder: true,
    orderAccepted: true,
    orderStatus: true,
    payment: true,
    rating: true,
    promotion: false,
  },
  security: {
    requireKYC: false,
    requirePhoneVerification: true,
    twoFactorAuth: false,
    sessionTimeout: 30,
  },
};

const KNOWN_KEYS = ['platform', 'payments', 'notifications', 'security'] as const;

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  /** Todo el objeto fusionado sobre los defaults (lo que ve el admin). */
  async getAll(): Promise<PlatformSettings> {
    const rows = await this.prisma.platformSetting.findMany();
    const stored: Record<string, any> = {};
    for (const r of rows) stored[r.key] = r.value;
    return {
      platform: { ...DEFAULT_SETTINGS.platform, ...(stored.platform ?? {}) },
      payments: { ...DEFAULT_SETTINGS.payments, ...(stored.payments ?? {}) },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(stored.notifications ?? {}) },
      security: { ...DEFAULT_SETTINGS.security, ...(stored.security ?? {}) },
    };
  }

  /** Guarda por secciones; valida tipos básicos y rechaza claves raras. */
  async saveAll(input: Partial<PlatformSettings>): Promise<PlatformSettings> {
    for (const key of Object.keys(input ?? {})) {
      if (!(KNOWN_KEYS as readonly string[]).includes(key)) {
        throw new BadRequestException(`Sección desconocida: ${key}`);
      }
    }
    const current = await this.getAll();
    const next: PlatformSettings = {
      platform: { ...current.platform, ...(input.platform ?? {}) },
      payments: { ...current.payments, ...(input.payments ?? {}) },
      notifications: { ...current.notifications, ...(input.notifications ?? {}) },
      security: { ...current.security, ...(input.security ?? {}) },
    };
    // Saneos numéricos mínimos
    next.platform.commission = Math.min(Math.max(Number(next.platform.commission) || 0, 0), 100);
    next.platform.minimumOrder = Math.max(Math.round(Number(next.platform.minimumOrder) || 0), 0);
    next.security.sessionTimeout = Math.min(
      Math.max(Math.round(Number(next.security.sessionTimeout) || 30), 5),
      480,
    );
    await this.prisma.$transaction(
      (Object.entries(next) as [string, unknown][]).map(([key, value]) =>
        this.prisma.platformSetting.upsert({
          where: { key },
          update: { value: value as any },
          create: { key, value: value as any },
        }),
      ),
    );
    return next;
  }

  /** Métodos habilitados (público: lo usan los checkouts para ocultar). */
  async getPaymentAvailability() {
    const all = await this.getAll();
    return {
      sinpe: !!all.payments.sinpeEnabled,
      card: !!all.payments.cardEnabled,
      cash: !!all.payments.cashEnabled,
      crypto: !!all.payments.cryptoEnabled,
    };
  }
}
