// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FollowsService {
  constructor(private prisma: PrismaService) {}

  /** Comercios que sigue el cliente (para la campana y la lista de perfil). */
  async myFollows(userId: string) {
    const rows = await this.prisma.merchantFollow.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        merchant: {
          select: {
            id: true,
            businessName: true,
            logoUrl: true,
            address: true,
            isHomeCook: true,
            category: true,
          },
        },
      },
    });
    return rows.map((r) => ({ ...(r.merchant as any), followedAt: r.createdAt }));
  }

  async isFollowing(userId: string, merchantId: string): Promise<boolean> {
    const row = await this.prisma.merchantFollow.findUnique({
      where: { userId_merchantId: { userId, merchantId } },
    });
    return !!row;
  }

  async follow(userId: string, merchantId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantId },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Comercio no encontrado');
    await this.prisma.merchantFollow.upsert({
      where: { userId_merchantId: { userId, merchantId } },
      update: {},
      create: { userId, merchantId },
    });
    return { following: true };
  }

  async unfollow(userId: string, merchantId: string) {
    await this.prisma.merchantFollow.deleteMany({ where: { userId, merchantId } });
    return { following: false };
  }

  async followersCount(merchantId: string): Promise<number> {
    return this.prisma.merchantFollow.count({ where: { merchantId } });
  }
}
