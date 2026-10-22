// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  resolveZonePrice,
  type LatLng,
  type PriceZone,
  type ZoneGeometry,
  type PriceResolution,
} from '../orders/zone-geometry';

const TTL_MS = 30_000;

/** Centro de Nicoya: origen para el modelo precio-vs-distancia. */
export const NICOYA_CENTER = { lat: 10.1467, lng: -85.452 } as const;

/** Haversine en km (local: zone-geometry no lo exporta). */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const t = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(t(lat2 - lat1) / 2) ** 2 +
    Math.cos(t(lat1)) * Math.cos(t(lat2)) * Math.sin(t(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export interface ZonePriceModel {
  base: number;
  ratePerKm: number;
  samples: number;
  minPrice: number;
  maxPrice: number;
  center: { lat: number; lng: number };
}

export interface ZoneInput {
  label: string;
  price: number;
  latitude?: number | null;
  longitude?: number | null;
  geometry?: ZoneGeometry | null;
  active?: boolean;
  sortOrder?: number;
}

/** Valida mínimamente la entrada (label/precio/polígono). */
function validate(input: ZoneInput): void {
  if (!input.label || !String(input.label).trim()) {
    throw new BadRequestException('La zona necesita un nombre');
  }
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0) {
    throw new BadRequestException('El precio debe ser un número ≥ 0');
  }
  const g = input.geometry;
  if (g) {
    if (g.type === 'Polygon' && (!g.coordinates?.[0] || g.coordinates[0].length < 3)) {
      throw new BadRequestException('El polígono necesita al menos 3 puntos');
    }
    if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') {
      throw new BadRequestException('Geometría inválida');
    }
  }
}

@Injectable()
export class ZonesService {
  // Cache de zonas activas (TTL corto); se invalida al mutar. El precio del
  // pedido se revalida contra esto (fuente de verdad), no contra el catálogo.
  private cache: { at: number; zones: PriceZone[] } | null = null;

  constructor(private prisma: PrismaService) {}

  private toPriceZone(z: any): PriceZone {
    return {
      id: z.id,
      label: z.label,
      price: Number(z.price),
      latitude: z.latitude != null ? Number(z.latitude) : null,
      longitude: z.longitude != null ? Number(z.longitude) : null,
      geometry: (z.geometry as ZoneGeometry) ?? null,
      referenceOnly: z.referenceOnly ?? !z.geometry,
    };
  }

  private async load(activeOnly: boolean): Promise<PriceZone[]> {
    if (activeOnly && this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache.zones;
    const rows = await (this.prisma as any).deliveryZone.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    const zones = rows.map((r: any) => this.toPriceZone(r));
    if (activeOnly) this.cache = { at: Date.now(), zones };
    return zones;
  }

  list(): Promise<PriceZone[]> {
    return this.load(true);
  }

  /** Admin: filas completas (incluye `active`, `sortOrder`, geometry cruda). */
  listAll(): Promise<any[]> {
    return (this.prisma as any).deliveryZone.findMany({
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  private invalidate(): void {
    this.cache = null;
  }

  async create(input: ZoneInput) {
    validate(input);
    const zone = await (this.prisma as any).deliveryZone.create({
      data: {
        label: input.label.trim(),
        price: input.price,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        geometry: input.geometry ?? null,
        referenceOnly: !input.geometry,
        active: input.active ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    this.invalidate();
    return zone;
  }

  async update(id: string, input: Partial<ZoneInput>) {
    const existing = await (this.prisma as any).deliveryZone.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Zona no encontrada');
    if (input.label !== undefined || input.price !== undefined) {
      validate({
        label: input.label ?? existing.label,
        price: input.price ?? Number(existing.price),
        geometry: input.geometry !== undefined ? input.geometry : existing.geometry,
      });
    }
    const zone = await (this.prisma as any).deliveryZone.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label.trim() } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        ...(input.geometry !== undefined
          ? { geometry: input.geometry, referenceOnly: !input.geometry }
          : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
    this.invalidate();
    return zone;
  }

  async deactivate(id: string) {
    const existing = await (this.prisma as any).deliveryZone.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Zona no encontrada');
    const zone = await (this.prisma as any).deliveryZone.update({
      where: { id },
      data: { active: false },
    });
    this.invalidate();
    return zone;
  }

  /** Precio por zona para un punto (polígono más específico, o referencia). */
  async resolvePriceAt(lat: number, lng: number): Promise<PriceResolution | null> {
    const zones = await this.list();
    return resolveZonePrice(zones, { lat, lng } as LatLng);
  }

  /**
   * Modelo precio-vs-distancia (mínimos cuadrados sobre las zonas activas
   * con punto): precio ≈ base + tarifa × km desde el centro de Nicoya.
   * Sirve para estimar cuánto cobrar al ABRIR una zona nueva, no para
   * re-preciar las existentes.
   */
  async priceModel(): Promise<ZonePriceModel> {
    const zones = await this.list();
    const pts = zones
      .map((z) => {
        if (z.latitude == null || z.longitude == null) return null;
        const la = Number(z.latitude);
        const ln = Number(z.longitude);
        if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
        return { d: haversineKm(NICOYA_CENTER.lat, NICOYA_CENTER.lng, la, ln), p: Number(z.price) };
      })
      .filter((p): p is { d: number; p: number } => p != null && Number.isFinite(p.p));
    const prices = pts.map((p) => p.p);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    if (pts.length < 2) {
      return {
        base: minPrice,
        ratePerKm: 0,
        samples: pts.length,
        minPrice,
        maxPrice,
        center: { ...NICOYA_CENTER },
      };
    }
    const n = pts.length;
    const sumD = pts.reduce((s, p) => s + p.d, 0);
    const sumP = pts.reduce((s, p) => s + p.p, 0);
    const sumDP = pts.reduce((s, p) => s + p.d * p.p, 0);
    const sumD2 = pts.reduce((s, p) => s + p.d * p.d, 0);
    const denom = n * sumD2 - sumD * sumD;
    const rate = denom === 0 ? 0 : (n * sumDP - sumD * sumP) / denom;
    const base = (sumP - rate * sumD) / n;
    return {
      base: Math.max(0, Math.round(base)),
      ratePerKm: Math.max(0, Math.round(rate)),
      samples: n,
      minPrice,
      maxPrice,
      center: { ...NICOYA_CENTER },
    };
  }

  /**
   * Precio sugerido para abrir una zona en (lat,lng): aplica el modelo y
   * lo acota al rango de precios vigentes, redondeado a ₡500 (el paso del
   * catálogo). Es punto de partida — el admin lo confirma al guardar.
   */
  async suggestPrice(
    lat: number,
    lng: number,
  ): Promise<{ price: number; distanceKm: number; base: number; ratePerKm: number }> {
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      throw new BadRequestException('Coordenadas inválidas');
    }
    const m = await this.priceModel();
    const distanceKm = haversineKm(NICOYA_CENTER.lat, NICOYA_CENTER.lng, lat, lng);
    const raw = m.base + m.ratePerKm * distanceKm;
    const rounded = Math.round(raw / 500) * 500;
    const price = Math.min(m.maxPrice, Math.max(m.minPrice, rounded));
    return {
      price,
      distanceKm: Math.round(distanceKm * 100) / 100,
      base: m.base,
      ratePerKm: m.ratePerKm,
    };
  }
}
