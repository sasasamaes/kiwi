// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags';
import { SettingsService } from '../settings/settings.service';
import { isKycRequired } from '../feature-flags/feature-flags';
import { startOfTodayCR, startOfMonthCR, toCRDateKey } from '../common/costa-rica-time';

const VALID_DRIVER_STATUSES = ['offline', 'available', 'busy'] as const;

@Injectable()
export class DriversService {
  constructor(
    private prisma: PrismaService,
    private flags: FeatureFlagsService,
    private settingsService: SettingsService,
  ) {}

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

    // El front necesita saber si el KYC bloquea hoy (feature flag), no solo
    // el estado del trámite de este repartidor.
    return { ...driver, kycRequired: isKycRequired() };
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
    if (!(VALID_DRIVER_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException(
        `Estado inválido: ${status}. Válidos: ${VALID_DRIVER_STATUSES.join(', ')}`,
      );
    }

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

  /**
   * Real directory of drivers for merchants: every driver profile, whatever
   * their current status. Merchants must be able to SEE (and favorite) the
   * driver they just recruited even if he is offline or pending KYC —
   * availability for assignment is enforced at assignment time, not by
   * hiding people from the list.
   */
  async getAvailableDrivers(latitude?: number, longitude?: number, opts?: { testOnly?: boolean }) {
    if (opts?.testOnly) {
      // Modo prueba del comercio: solo los pilotos (por email).
      const emails = await this.settingsService.getTestDriverEmails();
      return this.prisma.driverProfile.findMany({
        where: { user: { email: { in: emails } } },
        include: { user: { select: { phone: true, email: true } } },
        orderBy: [{ status: 'asc' }, { rating: 'desc' }],
      });
    }
    return this.prisma.driverProfile.findMany({
      include: {
        user: {
          select: {
            phone: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { rating: 'desc' }],
    });
  }

  /**
   * Repartidores con GPS reciente para el mapa vivo de operaciones (admin).
   * Solo pings de los últimos 15 min (el driver reporta cada ~30s mientras
   * está available); sin ubicación reciente no se plotea.
   */
  async getLiveDrivers() {
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const rows = await this.prisma.driverProfile.findMany({
      where: { lastSeenAt: { gte: since } },
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        vehicleType: true,
        vehiclePlate: true,
        rating: true,
        totalTrips: true,
        status: true,
        lastLat: true,
        lastLng: true,
        lastSeenAt: true,
      },
      orderBy: { lastSeenAt: 'desc' },
    });
    return rows
      .map((d) => ({
        id: d.id,
        name: d.fullName,
        photoUrl: (d as any).photoUrl ?? null,
        vehicle: d.vehicleType,
        vehiclePlate: (d as any).vehiclePlate ?? null,
        rating: d.rating != null ? Number(d.rating) : null,
        totalTrips: (d as any).totalTrips ?? 0,
        status: d.status,
        lat: d.lastLat != null ? Number(d.lastLat) : null,
        lng: d.lastLng != null ? Number(d.lastLng) : null,
        updatedAt: d.lastSeenAt,
      }))
      .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng));
  }

  async updateSchedule(userId: string, schedules: any[]) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    // Validate before touching the DB: delete-then-create without a
    // transaction would lose the whole agenda if the create fails.
    const rows = schedules.map((schedule) => {
      const dayOfWeek = Number(schedule.dayOfWeek);
      const startTime = new Date(schedule.startTime);
      const endTime = new Date(schedule.endTime);
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        throw new BadRequestException(`dayOfWeek inválido: ${schedule.dayOfWeek} (0-6)`);
      }
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new BadRequestException('Horario con fechas inválidas');
      }
      if (startTime >= endTime) {
        throw new BadRequestException('startTime debe ser anterior a endTime');
      }
      return {
        driverId: driver.id,
        dayOfWeek,
        startTime,
        endTime,
        isAvailable: schedule.isAvailable ?? true,
      };
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.driverSchedule.deleteMany({ where: { driverId: driver.id } });
      if (rows.length > 0) {
        return tx.driverSchedule.createMany({ data: rows });
      }
      return { count: 0 };
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

  // In-memory location cache (in production, use Redis)
  private driverLocations: Map<string, { lat: number; lng: number; updatedAt: Date }> = new Map();

  async updateLocation(userId: string, lat: number, lng: number, orderId?: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    const now = new Date();

    // Cache en memoria (mapas de tracking, lectura caliente).
    this.driverLocations.set(driver.id, { lat, lng, updatedAt: now });

    // Persistencia de "última conocida": alimenta el targeting por proximidad
    // de alertas de pedidos (ProximityService). Write-through barato: 1 update
    // por ping (el driver reporta cada ~30s mientras está available).
    await this.prisma.driverProfile.update({
      where: { id: driver.id },
      data: { lastLat: lat, lastLng: lng, lastSeenAt: now },
    });

    return {
      driverId: driver.id,
      lat,
      lng,
      updatedAt: now,
    };
  }

  async getLocation(driverId: string) {
    const location = this.driverLocations.get(driverId);

    if (!location) {
      // Fallback a la última conocida en DB (reinicios, multi-instancia o
      // pings que entraron por otro canal). Solo si no hay nada: fallback
      // ciego marcado como desconocido — el consumidor NO debe plotearlo.
      // try/catch (no .catch encadenado) porque el mock/driver puede
      // devolver no-promesa en tests.
      let db: any = null;
      try {
        db = await this.prisma.driverProfile.findUnique({ where: { id: driverId } });
      } catch {
        db = null;
      }
      const lat = Number((db as any)?.lastLat);
      const lng = Number((db as any)?.lastLng);
      if (db && Number.isFinite(lat) && Number.isFinite(lng)) {
        const at = (db as any).lastSeenAt ? new Date((db as any).lastSeenAt) : null;
        const isStale = !at || Date.now() - at.getTime() > 5 * 60 * 1000;
        return { driverId, lat, lng, updatedAt: at, isStale, known: true };
      }
      return {
        driverId,
        lat: 10.1483,
        lng: -85.4527,
        updatedAt: null,
        isStale: true,
        known: false,
      };
    }

    // Check if location is stale (> 5 minutes old)
    const isStale = Date.now() - location.updatedAt.getTime() > 5 * 60 * 1000;

    return {
      driverId,
      lat: location.lat,
      lng: location.lng,
      updatedAt: location.updatedAt,
      isStale,
      known: true,
    };
  }

  /**
   * Row-level guard for live GPS: the driver himself, a participant of one of
   * his ACTIVE orders (merchant owner, the assigned driver himself, or the
   * owning customer), or an admin. Delivered/cancelled orders no longer
   * grant tracking access.
   */
  async getLocationForUser(driverId: string, user: { sub?: string; role?: string }) {
    if (user?.role === 'admin') {
      return this.getLocation(driverId);
    }

    const userId = user?.sub;
    if (userId) {
      const profile = await this.prisma.driverProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (profile?.id === driverId) {
        return this.getLocation(driverId);
      }

      const activeOrder = await this.prisma.order.findFirst({
        where: {
          driverId,
          status: {
            in: ['assigned', 'in_transit_to_pickup', 'picked_up', 'in_transit_to_delivery'],
          },
          OR: [{ merchant: { userId } }, { driver: { userId } }, { customerId: userId }],
        },
        select: { id: true },
      });
      if (activeOrder) {
        return this.getLocation(driverId);
      }
    }

    throw new ForbiddenException('No tienes acceso a la ubicación de este repartidor');
  }

  async getEarnings(userId: string, period: string = 'all') {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date | undefined;

    switch (period) {
      case 'today':
        startDate = startOfTodayCR(now);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = startOfMonthCR(now, 0);
        break;
      default:
        startDate = undefined;
    }

    const where: any = {
      driverId: driver.id,
      status: 'delivered',
    };

    if (startDate) {
      where.deliveredAt = { gte: startDate };
    }

    // Get completed orders (merchant included for real names)
    const orders = await this.prisma.order.findMany({
      where,
      include: { merchant: { select: { businessName: true } } },
      orderBy: { deliveredAt: 'desc' },
    });

    // Calculate totals
    const totalEarnings = orders.reduce((sum, order) => sum + Number(order.driverPayout), 0);
    const totalTrips = orders.length;
    const averagePerTrip = totalTrips > 0 ? Math.round(totalEarnings / totalTrips) : 0;

    // Calculate hours (estimated 30 min per delivery)
    const totalHours = totalTrips * 0.5;
    const earningsPerHour = totalHours > 0 ? Math.round(totalEarnings / totalHours) : 0;

    // Daily breakdown for chart
    const dailyBreakdown: Record<string, number> = {};
    orders.forEach((order) => {
      const date = toCRDateKey(order.deliveredAt ?? order.createdAt);
      dailyBreakdown[date] = (dailyBreakdown[date] || 0) + Number(order.driverPayout);
    });

    // Convert to array for chart
    const dailyData = Object.entries(dailyBreakdown)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Transaction list
    const transactions = orders.map((order: any) => {
      const start = order.assignedAt ?? order.createdAt;
      const end = order.deliveredAt ?? order.createdAt;
      const durationSeconds =
        start && end
          ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000))
          : null;
      return {
        id: order.id,
        merchantName: order.merchant?.businessName ?? 'Comercio',
        pickupAddress: order.pickupAddress,
        deliveryAddress: order.deliveryAddress,
        amount: Number(order.driverPayout),
        date: order.deliveredAt || order.createdAt,
        orderType: order.orderType,
        assignedAt: order.assignedAt ?? null,
        deliveredAt: order.deliveredAt ?? null,
        durationSeconds,
      };
    });

    return {
      period,
      totalEarnings,
      totalTrips,
      averagePerTrip,
      totalHours,
      earningsPerHour,
      daily: dailyData,
      transactions,
      summary: {
        today: 0, // Will be calculated separately if needed
        thisWeek: 0,
        thisMonth: 0,
        allTime: totalEarnings,
      },
    };
  }

  /**
   * Historial del repartidor: TODOS sus pedidos (entregados, cancelados,
   * en curso…) con filtro opcional por estado. Lo que Ganancias no muestra
   * (no entregados) vive acá.
   */
  async driverOrders(userId: string, opts: { status?: string; take?: number; skip?: number } = {}) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Perfil de repartidor no encontrado');
    }

    if (opts.status) {
      const valid = new Set([
        'pending',
        'driver_proposals',
        'pending_acceptance',
        'assigned',
        'in_transit_to_pickup',
        'picked_up',
        'in_transit_to_delivery',
        'delivered',
        'cancelled',
        'no_driver',
      ]);
      if (!valid.has(opts.status)) throw new BadRequestException('Estado inválido');
    }
    const take = Math.min(Math.max(Number(opts.take ?? 20), 1), 100);
    const skip = Math.max(Number(opts.skip ?? 0), 0);

    const where: any = { driverId: driver.id };
    if (opts.status) where.status = opts.status;

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: { merchant: { select: { businessName: true } } },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
    ]);

    return {
      total,
      items: orders.map((order: any) => {
        const start = order.assignedAt ?? order.createdAt;
        const end = order.deliveredAt ?? order.createdAt;
        const durationSeconds =
          order.status === 'delivered' && start && end
            ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000))
            : null;
        return {
          id: order.id,
          status: order.status,
          orderType: order.orderType,
          merchantName: order.merchant?.businessName ?? null,
          pickupAddress: order.pickupAddress,
          deliveryAddress: order.deliveryAddress,
          driverPayout: Number(order.driverPayout ?? 0),
          totalAmount: Number(order.totalAmount ?? 0),
          createdAt: order.createdAt,
          assignedAt: order.assignedAt ?? null,
          deliveredAt: order.deliveredAt ?? null,
          durationSeconds,
        };
      }),
    };
  }

  /**
   * Ranking interno de repartidores por velocidad de entrega.
   * Métrica: tiempo promedio assignedAt → deliveredAt en el período.
   * Solo cuenta entregados con ambos timestamps; mínimo 3 viajes para
   * no premiar una entrega suerte. Orden: más rápido primero.
   */
  async getRanking(period: string = 'week') {
    const now = new Date();
    let startDate: Date | undefined;
    switch (period) {
      case 'today':
        startDate = startOfTodayCR(now);
        break;
      case 'month':
        startDate = startOfMonthCR(now, 0);
        break;
      case 'all':
        startDate = undefined;
        break;
      case 'week':
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    const where: any = {
      status: 'delivered',
      assignedAt: { not: null },
      deliveredAt: { not: null },
    };
    if (startDate) where.deliveredAt = { gte: startDate };

    const orders = await this.prisma.order.findMany({
      where,
      select: {
        driverId: true,
        assignedAt: true,
        deliveredAt: true,
        driver: { select: { id: true, fullName: true, photoUrl: true, vehicleType: true } },
      },
      take: 5000,
      orderBy: { deliveredAt: 'desc' },
    });

    const byDriver = new Map<
      string,
      { name: string; photoUrl: string | null; vehicleType: string; total: number; trips: number }
    >();
    for (const o of orders as any[]) {
      if (!o.driverId || !o.assignedAt || !o.deliveredAt) continue;
      const secs = Math.round(
        (new Date(o.deliveredAt).getTime() - new Date(o.assignedAt).getTime()) / 1000,
      );
      // Viajes imposibles (<1 min o >4h) se descartan: GPS/arrastre viejo.
      if (!Number.isFinite(secs) || secs < 60 || secs > 4 * 3600) continue;
      const key = o.driverId;
      const cur = byDriver.get(key) ?? {
        name: o.driver?.fullName ?? 'Repartidor',
        photoUrl: o.driver?.photoUrl ?? null,
        vehicleType: o.driver?.vehicleType ?? 'motorcycle',
        total: 0,
        trips: 0,
      };
      cur.total += secs;
      cur.trips += 1;
      byDriver.set(key, cur);
    }

    const ranking = [...byDriver.entries()]
      .filter(([, v]) => v.trips >= 3)
      .map(([driverId, v]) => ({
        driverId,
        name: v.name,
        photoUrl: v.photoUrl,
        vehicleType: v.vehicleType,
        trips: v.trips,
        avgSeconds: Math.round(v.total / v.trips),
      }))
      .sort((a, b) => a.avgSeconds - b.avgSeconds || b.trips - a.trips);

    return { period, ranking };
  }

  /** Lista corta de repartidores para filtros del admin (id + nombre). */
  async adminList() {
    return this.prisma.driverProfile.findMany({
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    });
  }
}
