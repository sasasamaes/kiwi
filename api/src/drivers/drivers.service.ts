import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const driver = await this.prisma.driverProfile.findUnique({
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
        schedules: true,
        incentives: true,
        _count: {
          select: {
            orders: true,
            ratings: true,
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException('Repartidor no encontrado');
    }

    return driver;
  }

  async findByUserId(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        schedules: true,
        incentives: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    return driver;
  }

  async updateProfile(userId: string, data: any) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    return this.prisma.driverProfile.update({
      where: { userId },
      data: {
        fullName: data.fullName,
        vehicleType: data.vehicleType,
        vehiclePlate: data.vehiclePlate,
        photoUrl: data.photoUrl,
      },
    });
  }

  async updateStatus(userId: string, status: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    return this.prisma.driverProfile.update({
      where: { userId },
      data: { status: status as any },
    });
  }

  async getAvailableDrivers(latitude?: number, longitude?: number) {
    return this.prisma.driverProfile.findMany({
      where: {
        status: 'available',
        kycStatus: 'approved',
      },
      include: {
        user: {
          select: {
            phone: true,
          },
        },
      },
      orderBy: {
        rating: 'desc',
      },
    });
  }

  async updateSchedule(userId: string, schedules: any[]) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    // Delete existing schedules
    await this.prisma.driverSchedule.deleteMany({
      where: { driverId: driver.id },
    });

    // Create new schedules
    return this.prisma.driverSchedule.createMany({
      data: schedules.map((schedule) => ({
        driverId: driver.id,
        dayOfWeek: schedule.dayOfWeek,
        startTime: new Date(schedule.startTime),
        endTime: new Date(schedule.endTime),
        isAvailable: schedule.isAvailable ?? true,
      })),
    });
  }

  async getSchedules(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    return this.prisma.driverSchedule.findMany({
      where: { driverId: driver.id },
      orderBy: { dayOfWeek: 'asc' },
    });
  }
}
