// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeCRPhone } from '../common/phone';

const VALID_VEHICLE_TYPES = ['motorcycle', 'motorized_bike', 'bicycle', 'car', 'truck'];

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        merchantProfile: true,
        driverProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.sanitizeUser(user);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Admin user list: sanitized rows with profile display data.
   * No password hashes ever leave this service (see sanitizeUser).
   */
  async listUsers(filters?: {
    role?: string;
    status?: string;
    search?: string;
    take?: number;
    skip?: number;
  }) {
    const take = Math.min(Math.max(Number(filters?.take) || 50, 1), 200);
    const skip = Math.max(Number(filters?.skip) || 0, 0);
    const where: any = {};
    if (filters?.role && ['merchant', 'driver', 'admin'].includes(filters.role)) {
      where.role = filters.role;
    }
    if (filters?.status && ['active', 'inactive', 'pending'].includes(filters.status)) {
      where.status = filters.status;
    }
    if (filters?.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: {
          merchantProfile: {
            select: {
              id: true,
              businessName: true,
              kycStatus: true,
              cardPaymentsEnabled: true,
              isHomeCook: true,
              _count: { select: { orders: true } },
            },
          },
          driverProfile: {
            select: {
              fullName: true,
              rating: true,
              totalTrips: true,
              kycStatus: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
    ]);

    return {
      total,
      take,
      skip,
      users: users.map((u) => this.sanitizeUser(u)),
    };
  }

  /**
   * Admin activate/deactivate. Role changes and deletes are deliberately
   * unsupported here; self-deactivation is blocked (lockout prevention).
   */
  async setStatus(targetUserId: string, status: string, requesterId: string) {
    if (targetUserId === requesterId) {
      throw new ForbiddenException('No puedes desactivar tu propia cuenta');
    }
    if (status !== 'active' && status !== 'inactive') {
      throw new BadRequestException('status inválido: use active o inactive');
    }
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    await this.prisma.user.update({ where: { id: targetUserId }, data: { status: status as any } });
    return this.findById(targetUserId);
  }

  async updateProfile(userId: string, data: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        merchantProfile: true,
        driverProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Teléfono propio (cualquier rol): se normaliza a 8888-8888 y debe ser
    // único. Vacío lo libera (null) para no bloquear si cambia de número.
    if (data.phone !== undefined) {
      const raw = String(data.phone ?? '').trim();
      if (raw === '') {
        await this.prisma.user.update({ where: { id: userId }, data: { phone: null } });
      } else {
        const phone = normalizeCRPhone(raw);
        if (!phone) {
          throw new BadRequestException('Formato de teléfono inválido (8888-8888)');
        }
        const taken = await this.prisma.user.findFirst({
          where: { phone, role: user.role, id: { not: userId } },
          select: { id: true },
        });
        if (taken) {
          throw new ConflictException('Ese teléfono ya está registrado en una cuenta de este tipo');
        }
        await this.prisma.user.update({ where: { id: userId }, data: { phone } });
      }
    }

    // Update profile based on role
    if (user.role === 'merchant' && user.merchantProfile) {
      await this.prisma.merchantProfile.update({
        where: { userId },
        data: {
          businessName: data.businessName,
          address: data.address,
          description: data.description,
        },
      });
    } else if (user.role === 'driver' && user.driverProfile) {
      if (data.vehicleType !== undefined && !VALID_VEHICLE_TYPES.includes(data.vehicleType)) {
        throw new BadRequestException(`vehicleType inválido: ${data.vehicleType}`);
      }
      await this.prisma.driverProfile.update({
        where: { userId },
        data: {
          fullName: data.fullName,
          vehicleType: data.vehicleType,
          vehiclePlate: data.vehiclePlate,
        },
      });
    }

    return this.findById(userId);
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
