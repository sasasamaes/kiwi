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

  listAll(): Promise<PriceZone[]> {
    return this.load(false);
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
}
