// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Máximo de lugares guardados (antispam de libreta). */
export const MAX_SAVED_ADDRESSES = 10;

function sanitizeAddressInput(data: any) {
  const out: Record<string, any> = {};
  if (data.label !== undefined) {
    const label = String(data.label ?? '')
      .trim()
      .slice(0, 40);
    if (!label) throw new BadRequestException('El lugar necesita un nombre (ej. Casa)');
    out.label = label;
  }
  if (data.address !== undefined) {
    const address = String(data.address ?? '')
      .trim()
      .slice(0, 200);
    if (!address) throw new BadRequestException('La dirección es requerida');
    out.address = address;
  }
  const lat = data.latitude !== undefined ? Number(data.latitude) : NaN;
  const lng = data.longitude !== undefined ? Number(data.longitude) : NaN;
  if (data.latitude !== undefined || data.longitude !== undefined) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('Coordenadas inválidas');
    }
    out.latitude = lat;
    out.longitude = lng;
  }
  if (data.deliveryZone !== undefined) {
    out.deliveryZone =
      String(data.deliveryZone ?? '')
        .trim()
        .slice(0, 60) || null;
  }
  return out;
}

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async me(userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Perfil de cliente no encontrado');
    return profile;
  }

  async updateMe(userId: string, dto: any) {
    const data: any = {};
    if (dto.fullName !== undefined) data.fullName = String(dto.fullName).slice(0, 80) || null;
    if (dto.defaultAddress !== undefined)
      data.defaultAddress = String(dto.defaultAddress).slice(0, 200) || null;
    if (dto.deliveryZone !== undefined)
      data.deliveryZone = String(dto.deliveryZone).slice(0, 60) || null;
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      const lat = Number(dto.latitude);
      const lng = Number(dto.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        data.latitude = lat;
        data.longitude = lng;
      }
    }
    if (dto.citySlug !== undefined) {
      const slug = String(dto.citySlug).trim().toLowerCase();
      const city = await this.prisma.city.findUnique({ where: { slug } });
      if (city) data.citySlug = city.slug;
    }
    // Avatar: URL https (foto subida) o emoji elegido; null lo quita.
    // Máx 500 chars (una URL de Cloudinary cabe de sobra).
    if (dto.avatarUrl !== undefined) {
      if (dto.avatarUrl === null || String(dto.avatarUrl).trim() === '') {
        data.avatarUrl = null;
      } else {
        data.avatarUrl = String(dto.avatarUrl).slice(0, 500);
      }
    }
    return this.prisma.customerProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, citySlug: data.citySlug || 'nicoya', ...data },
    });
  }

  /** Libreta del cliente (orden: default primero, luego recientes). */
  async listAddresses(userId: string) {
    return (this.prisma as any).customerAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(userId: string, data: any) {
    const input = sanitizeAddressInput({ ...data, label: data?.label, address: data?.address });
    if (!input.label || !input.address) {
      throw new BadRequestException('Nombre del lugar y dirección requeridos');
    }
    const count = await (this.prisma as any).customerAddress.count({ where: { userId } });
    if (count >= MAX_SAVED_ADDRESSES) {
      throw new BadRequestException(`Máximo ${MAX_SAVED_ADDRESSES} lugares guardados`);
    }
    const row: any = await (this.prisma as any).customerAddress.create({
      data: { userId, ...input, isDefault: count === 0 },
    });
    return row;
  }

  async updateAddress(userId: string, id: string, data: any) {
    const row: any = await (this.prisma as any).customerAddress.findUnique({ where: { id } });
    if (!row || row.userId !== userId) throw new NotFoundException('Dirección no encontrada');
    const input = sanitizeAddressInput(data);
    if (Object.keys(input).length === 0) throw new BadRequestException('Nada que actualizar');
    // label/address parciales se completan con lo guardado (el validador
    // exige ambos solo al crear).
    return (this.prisma as any).customerAddress.update({ where: { id }, data: input });
  }

  async deleteAddress(userId: string, id: string) {
    const row: any = await (this.prisma as any).customerAddress.findUnique({ where: { id } });
    if (!row || row.userId !== userId) throw new NotFoundException('Dirección no encontrada');
    await (this.prisma as any).customerAddress.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Marca un lugar como default (y sincroniza el perfil: dirección, GPS y
   * zona que el checkout pre-llena).
   */
  async setDefaultAddress(userId: string, id: string) {
    const row: any = await (this.prisma as any).customerAddress.findUnique({ where: { id } });
    if (!row || row.userId !== userId) throw new NotFoundException('Dirección no encontrada');
    await (this.prisma as any).customerAddress.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
    await (this.prisma as any).customerAddress.update({
      where: { id },
      data: { isDefault: true },
    });
    try {
      await this.prisma.customerProfile.upsert({
        where: { userId },
        update: {
          defaultAddress: row.address,
          latitude: row.latitude ?? undefined,
          longitude: row.longitude ?? undefined,
          deliveryZone: row.deliveryZone ?? undefined,
        },
        create: { userId, citySlug: 'nicoya', defaultAddress: row.address },
      });
    } catch {
      // best-effort: el default de la libreta ya quedó
    }
    return { default: true };
  }
}
