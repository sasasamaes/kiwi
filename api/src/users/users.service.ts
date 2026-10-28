// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
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
    return this.prisma.user.findFirst({
      where: {
        email: {
          equals: String(email ?? '')
            .trim()
            .toLowerCase(),
          mode: 'insensitive',
        },
      },
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
              address: true,
              latitude: true,
              longitude: true,
              logoUrl: true,
              kycStatus: true,
              cardPaymentsEnabled: true,
              weeklyBillingEnabled: true,
              testOrdersEnabled: true,
              testOrdersUntil: true,
              parentMerchantId: true,
              transfersEnabled: true,
              branches: { select: { id: true, businessName: true } },
              isHomeCook: true,
              pushCredits: true,
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

  /**
   * Admin desbloquea el throttle de login (intentos fallidos). La clave
   * correcta igual siempre entra; esto limpia el 429 para quien sigue
   * errando (típico: olvidó la clave → mejor aún, usar recupero por email).
   */
  async unlockLogin(targetUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const wasLocked =
      (user as any).loginLockedUntil != null &&
      new Date((user as any).loginLockedUntil).getTime() > Date.now();
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { failedLoginAttempts: 0, loginLockedUntil: null },
    });
    return { user: await this.findById(targetUserId), wasLocked };
  }

  /**
   * Admin fija la contraseña de un usuario (soporte: "olvidé mi clave").
   * Resetea el throttle de login y sube tokenVersion para revocar sesiones
   * y WS vivos del dueño anterior de la clave.
   */
  async setPassword(targetUserId: string, password: string) {
    if (typeof password !== 'string' || password.length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    }
    if (password.length > 128) {
      throw new BadRequestException('La contraseña no puede superar 128 caracteres');
    }
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        loginLockedUntil: null,
        tokenVersion: { increment: 1 },
      },
    });
    return this.findById(targetUserId);
  }

  /**
   * Admin fija el punto GPS de retiro de un comercio (dónde llegan los
   * repartidores). Ambos null quitan el punto. Lo ve el mapa general de
   * zonas y lo heredan los pedidos como pickup por defecto.
   */
  async setMerchantLocation(
    targetUserId: string,
    data: { latitude?: number | null; longitude?: number | null },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { merchantProfile: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (user.role !== 'merchant' || !user.merchantProfile) {
      throw new BadRequestException('El usuario no es un comercio');
    }
    const latRaw = data?.latitude ?? null;
    const lngRaw = data?.longitude ?? null;
    if ((latRaw == null) !== (lngRaw == null)) {
      throw new BadRequestException('Ubicación incompleta: latitud y longitud juntas o ninguna');
    }
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (latRaw != null && lngRaw != null) {
      latitude = Number(latRaw);
      longitude = Number(lngRaw);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new BadRequestException('Coordenadas inválidas');
      }
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new BadRequestException('Coordenadas fuera de rango');
      }
    }
    await this.prisma.merchantProfile.update({
      where: { userId: targetUserId },
      data: { latitude, longitude },
    });
    return this.findById(targetUserId);
  }

  /**
   * Admin completa la info básica de un comercio (setup rápido desde soporte):
   * nombre, dirección, descripción, logo y teléfono. Solo merchant.
   */
  async updateMerchantProfileAdmin(
    targetUserId: string,
    data: {
      businessName?: string;
      address?: string | null;
      description?: string | null;
      logoUrl?: string | null;
      phone?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { merchantProfile: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (user.role !== 'merchant' || !user.merchantProfile) {
      throw new BadRequestException('El usuario no es un comercio');
    }
    if (data.phone !== undefined) {
      const raw = String(data.phone ?? '').trim();
      if (raw === '') {
        await this.prisma.user.update({ where: { id: targetUserId }, data: { phone: null } });
      } else {
        const phone = normalizeCRPhone(raw);
        if (!phone) {
          throw new BadRequestException('Formato de teléfono inválido (8888-8888)');
        }
        const taken = await this.prisma.user.findFirst({
          where: { phone, role: 'merchant', id: { not: targetUserId } },
          select: { id: true },
        });
        if (taken) {
          throw new ConflictException('Ese teléfono ya está registrado en otro comercio');
        }
        await this.prisma.user.update({ where: { id: targetUserId }, data: { phone } });
      }
    }
    const patch: any = {};
    if (data.businessName !== undefined) {
      const name = String(data.businessName ?? '').trim();
      if (!name) throw new BadRequestException('El nombre del negocio es requerido');
      patch.businessName = name;
    }
    if (data.address !== undefined) patch.address = String(data.address ?? '').trim() || null;
    if (data.description !== undefined)
      patch.description = String(data.description ?? '').trim() || null;
    if (data.logoUrl !== undefined) patch.logoUrl = String(data.logoUrl ?? '').trim() || null;
    if (Object.keys(patch).length > 0) {
      await this.prisma.merchantProfile.update({ where: { userId: targetUserId }, data: patch });
    }
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
    return {
      ...sanitized,
      loginLocked:
        sanitized.loginLockedUntil != null &&
        new Date(sanitized.loginLockedUntil).getTime() > Date.now(),
    };
  }
}
