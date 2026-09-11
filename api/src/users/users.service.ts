import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
