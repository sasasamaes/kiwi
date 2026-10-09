// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    return this.prisma.customerProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, citySlug: data.citySlug || 'nicoya', ...data },
    });
  }
}
