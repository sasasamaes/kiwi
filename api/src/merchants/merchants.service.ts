// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isMerchantCategory } from './merchant-category';

@Injectable()
export class MerchantsService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            status: true,
          },
        },
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        favoriteDrivers: {
          include: {
            driver: true,
          },
        },
      },
    });

    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado');
    }

    return merchant;
  }

  async findByUserId(userId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      include: {
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!merchant) {
      throw new NotFoundException('Perfil de comercio no encontrado');
    }

    return merchant;
  }

  async updateProfile(userId: string, data: any) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId },
    });

    if (!merchant) {
      throw new NotFoundException('Perfil de comercio no encontrado');
    }

    const extra: Record<string, unknown> = {};
    if (data.category !== undefined) {
      if (!isMerchantCategory(data.category)) {
        throw new BadRequestException('Categoría inválida');
      }
      extra.category = data.category;
    }

    return this.prisma.merchantProfile.update({
      where: { userId },
      data: {
        businessName: data.businessName,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        description: data.description,
        openingHours: data.openingHours,
        ...extra,
      },
    });
  }

  async addFavoriteDriver(merchantId: string, driverId: string) {
    return this.prisma.favoriteDriver.create({
      data: {
        merchantId,
        driverId,
      },
    });
  }

  async removeFavoriteDriver(merchantId: string, driverId: string) {
    return this.prisma.favoriteDriver.deleteMany({
      where: {
        merchantId,
        driverId,
      },
    });
  }

  async getFavoriteDrivers(merchantId: string) {
    return this.prisma.favoriteDriver.findMany({
      where: { merchantId },
      include: {
        driver: true,
      },
    });
  }
}
