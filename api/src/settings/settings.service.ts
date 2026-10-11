// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PlatformSettings {
  platform: {
    name: string;
    commission: number;
    /** Comisión % para cocinas caseras (emprendedores). Default = standard. */
    homeCookCommission: number;
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
  /**
   * Costos operativos reales (los edita el admin; base del reporte
   * "Real vs Proyección" para calcular la GANANCIA NETA real).
   */
  operations: {
    /** Costos fijos mensuales: hosting, infra, equipo base. */
    fixedMonthlyCost: number;
    /** Costo de soporte/operación por viaje (chats, incidencias). */
    supportPerTrip: number;
    /** Fee % de la pasarela de pago (tarjeta/SINPE web). */
    gatewayPct: number;
    /** % de pagos que llegan por canal digital (el efectivo no paga fee). */
    digitalPct: number;
  };
  assignment: {
    acceptanceMinutes: number;
    contestMinutes: number;
  };
}

/** Valores con los que nace la plataforma (y fallback si algo falta). */
export const DEFAULT_SETTINGS: PlatformSettings = {
  platform: {
    name: 'Kiwi',
    commission: 15,
    // Incentivo emprendedor: Kiwi se queda con 10% en cocina casera
    // (15% en el resto). Lo puede subir/bajar el admin.
    homeCookCommission: 10,
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
  operations: {
    fixedMonthlyCost: 150_000,
    supportPerTrip: 25,
    gatewayPct: 2.9,
    digitalPct: 40,
  },
  assignment: { acceptanceMinutes: 5, contestMinutes: 10 },
};

const KNOWN_KEYS = [
  'platform',
  'payments',
  'notifications',
  'security',
  'operations',
  'assignment',
] as const;

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // Caché en memoria: getAll se llama en cada POST /orders y checkout.
  // TTL 45s + single-flight; se invalida en saveAll. La tasa queda
  // guardada por pedido, así que un stale de 45s es seguro.
  private cached: { at: number; value: PlatformSettings } | null = null;
  private inflight: Promise<PlatformSettings> | null = null;
  private static readonly TTL_MS = 45_000;

  /** Todo el objeto fusionado sobre los defaults (lo que ve el admin). */
  async getAll(): Promise<PlatformSettings> {
    const now = Date.now();
    if (this.cached && now - this.cached.at < SettingsService.TTL_MS) {
      return this.cached.value;
    }
    if (this.inflight) return this.inflight;
    this.inflight = this.loadAll().then((value) => {
      this.cached = { at: Date.now(), value };
      this.inflight = null;
      return value;
    });
    try {
      return await this.inflight;
    } catch (e) {
      this.inflight = null;
      throw e;
    }
  }

  private async loadAll(): Promise<PlatformSettings> {
    const rows = await this.prisma.platformSetting.findMany();
    const stored: Record<string, any> = {};
    for (const r of rows) stored[r.key] = r.value;
    return {
      platform: { ...DEFAULT_SETTINGS.platform, ...(stored.platform ?? {}) },
      payments: { ...DEFAULT_SETTINGS.payments, ...(stored.payments ?? {}) },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(stored.notifications ?? {}) },
      security: { ...DEFAULT_SETTINGS.security, ...(stored.security ?? {}) },
      operations: { ...DEFAULT_SETTINGS.operations, ...(stored.operations ?? {}) },
      assignment: { ...DEFAULT_SETTINGS.assignment, ...(stored.assignment ?? {}) },
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
      operations: { ...current.operations, ...(input.operations ?? {}) },
      assignment: { ...current.assignment, ...(input.assignment ?? {}) },
    };
    // Saneos numéricos mínimos
    next.platform.commission = Math.min(Math.max(Number(next.platform.commission) || 0, 0), 100);
    next.platform.homeCookCommission = Math.min(
      Math.max(Number(next.platform.homeCookCommission) || 0, 0),
      100,
    );
    next.platform.minimumOrder = Math.max(Math.round(Number(next.platform.minimumOrder) || 0), 0);
    next.security.sessionTimeout = Math.min(
      Math.max(Math.round(Number(next.security.sessionTimeout) || 30), 5),
      480,
    );
    next.operations.fixedMonthlyCost = Math.max(
      Math.round(Number(next.operations.fixedMonthlyCost) || 0),
      0,
    );
    next.operations.supportPerTrip = Math.max(
      Math.round(Number(next.operations.supportPerTrip) || 0),
      0,
    );
    next.operations.gatewayPct = Math.min(
      Math.max(Number(next.operations.gatewayPct) || 0, 0),
      100,
    );
    next.operations.digitalPct = Math.min(
      Math.max(Number(next.operations.digitalPct) || 0, 0),
      100,
    );
    const clampMin = (v: unknown, dflt: number) =>
      Math.min(Math.max(Math.round(Number(v) || dflt), 1), 60);
    next.assignment.acceptanceMinutes = clampMin(next.assignment.acceptanceMinutes, 5);
    next.assignment.contestMinutes = clampMin(next.assignment.contestMinutes, 10);
    await this.prisma.$transaction(
      (Object.entries(next) as [string, unknown][]).map(([key, value]) =>
        this.prisma.platformSetting.upsert({
          where: { key },
          update: { value: value as any },
          create: { key, value: value as any },
        }),
      ),
    );
    this.cached = { at: Date.now(), value: next };
    return next;
  }
  /** Limpia la caché en memoria (tests y casos donde se escribió por fuera). */
  clearCache(): void {
    this.cached = null;
    this.inflight = null;
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

  /**
   * % standard del cargo por servicio (lo cobra Kiwi, extra sobre productos).
   * Lo edita el admin en /admin/settings; el pricing lo lee por pedido.
   * Saneado 0–100, default 15. Queda guardado por pedido en commissionRate,
   * así que cambiarlo solo afecta pedidos NUEVOS.
   */
  async getDriverCommissionPct(): Promise<number> {
    const all = await this.getAll();
    const raw = Number(all.platform?.commission);
    if (!Number.isFinite(raw)) return 15;
    return Math.min(Math.max(raw, 0), 100);
  }

  /**
   * % de comisión para pedidos de cocinas caseras (incentivo emprendedor:
   * 10% vs 15% standard). Lo edita el admin en /admin/settings. Igual que
   * la standard, queda guardada por pedido: solo afecta pedidos NUEVOS.
   */
  async getHomeCookCommissionPct(): Promise<number> {
    const all = await this.getAll();
    const raw = Number(all.platform?.homeCookCommission);
    if (!Number.isFinite(raw)) return this.getDriverCommissionPct();
    return Math.min(Math.max(raw, 0), 100);
  }

  /** Minutos de aceptación y de concurso (admin, default 5/10, saneado 1–60). */
  async getAssignmentTimeouts(): Promise<{ acceptanceMinutes: number; contestMinutes: number }> {
    const all = await this.getAll();
    const clamp = (v: unknown, dflt: number) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? Math.min(Math.max(n, 1), 60) : dflt;
    };
    return {
      acceptanceMinutes: clamp(all.assignment?.acceptanceMinutes, 5),
      contestMinutes: clamp(all.assignment?.contestMinutes, 10),
    };
  }

  /** Historial mensual de escenarios fijados (más antiguo primero). */
  async listScenarioSnapshots() {
    return this.prisma.scenarioSnapshot.findMany({ orderBy: { month: 'asc' } });
  }

  /**
   * Fija (o re-fija) el escenario proyectado de un mes: es la foto con la que
   * después se comparará lo realmente ocurrido. Un snapshot por mes.
   */
  async upsertScenarioSnapshot(input: {
    month?: string;
    ordersPerDay?: number;
    expectedTrip?: number;
    commissionPct?: number;
    operations?: {
      fixedMonthlyCost?: number;
      supportPerTrip?: number;
      gatewayPct?: number;
      digitalPct?: number;
    };
    projectedCommission?: number;
    projectedNet?: number;
    note?: string | null;
  }) {
    const month = String(input?.month ?? '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException('month debe tener formato YYYY-MM');
    }
    const ordersPerDay = Math.max(0, Math.round(Number(input.ordersPerDay) || 0));
    const expectedTrip = Math.max(0, Number(input.expectedTrip) || 0);
    const commissionPct = Math.min(Math.max(Number(input.commissionPct) || 0, 0), 100);
    const operations = {
      fixedMonthlyCost: Math.max(0, Number(input.operations?.fixedMonthlyCost) || 0),
      supportPerTrip: Math.max(0, Number(input.operations?.supportPerTrip) || 0),
      gatewayPct: Math.min(Math.max(Number(input.operations?.gatewayPct) || 0, 0), 100),
      digitalPct: Math.min(Math.max(Number(input.operations?.digitalPct) || 0, 0), 100),
    };
    const projectedCommission = Math.max(0, Number(input.projectedCommission) || 0);
    const projectedNet = Number(input.projectedNet) || 0;
    const note =
      typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 200) : null;

    return this.prisma.scenarioSnapshot.upsert({
      where: { month },
      update: {
        ordersPerDay,
        expectedTrip,
        commissionPct,
        operations,
        projectedCommission,
        projectedNet,
        note,
      },
      create: {
        month,
        ordersPerDay,
        expectedTrip,
        commissionPct,
        operations,
        projectedCommission,
        projectedNet,
        note,
      },
    });
  }
}
