// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  GoneException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { ZonesService } from '../zones/zones.service';
import { normalizeCRPhone } from '../common/phone';

/** Validez del link de reparto compartido por el comercio. */
const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Métodos con los que el comercio puede pagar el viaje del link. */
const LINK_PAYMENT_METHODS = ['cash', 'credit', 'weekly_invoice'] as const;

export interface CreateDeliveryLinkDto {
  deliveryZone: string;
  paymentMethod: string;
  /** Quién paga el viaje: merchant (rebaja crédito) o customer (SINPE directo). */
  paidBy?: string;
}

export interface SubmitDeliveryLinkDto {
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryLat?: number | string | null;
  deliveryLng?: number | string | null;
  packageDescription?: string;
  packageSize?: string;
  weightKg?: number | string | null;
  specialInstructions?: string;
  idempotencyKey?: string;
}

@Injectable()
export class DeliveryLinksService {
  private readonly logger = new Logger(DeliveryLinksService.name);

  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
    private paymentsService: PaymentsService,
    private zonesService: ZonesService,
    private configService: ConfigService,
  ) {}

  private clientBaseUrl(): string {
    const base =
      this.configService.get<string>('CLIENT_URL') ??
      this.configService.get<string>('WEB_URL') ??
      'http://localhost:3002';
    return base.replace(/\/$/, '');
  }

  private newToken(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('hex');
    return { raw, hash: createHash('sha256').update(raw).digest('hex') };
  }

  /** Quita el hash: el token crudo solo viaja en la URL compartida. */
  private sanitize(row: any) {
    const { tokenHash: _tokenHash, ...rest } = row ?? {};
    return rest;
  }

  private linkUrl(raw: string): string {
    return `${this.clientBaseUrl()}/order/delivery/${raw}`;
  }

  private async merchantOf(userId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId },
    });
    if (!merchant) throw new NotFoundException('Perfil de comercio no encontrado');
    return merchant;
  }

  /** Zona vigente por id (el precio siempre sale de acá, nunca del cliente). */
  private async zoneById(zoneId: string) {
    const zones = await this.zonesService.list();
    const zone = zones.find((z: any) => z.id === zoneId);
    if (!zone) throw new BadRequestException('Barrio de entrega inválido');
    return zone;
  }

  private assertMethodForMerchant(merchant: any, method: string) {
    if (!(LINK_PAYMENT_METHODS as readonly string[]).includes(method)) {
      throw new BadRequestException('Método de pago inválido para el link');
    }
    if (method === 'weekly_invoice' && (merchant as any).weeklyBillingEnabled !== true) {
      throw new BadRequestException('Tu comercio no tiene activada la facturación semanal');
    }
  }

  /**
   * Crea el link: el comercio elige barrio + con qué paga el viaje.
   * Devuelve la URL pública lista para compartir.
   */
  async create(merchantUserId: string, dto: CreateDeliveryLinkDto) {
    const merchant = await this.merchantOf(merchantUserId);
    const zone = await this.zoneById(String(dto?.deliveryZone ?? ''));
    // Si lo paga el cliente por SINPE no hay movimiento de crédito: el
    // método se fuerza a efectivo y el cobro es directo al comercio.
    const paidBy = String(dto?.paidBy ?? 'merchant') === 'customer' ? 'customer' : 'merchant';
    const method = paidBy === 'customer' ? 'cash' : String(dto?.paymentMethod ?? '');
    this.assertMethodForMerchant(merchant, method);
    const { raw, hash } = this.newToken();
    const row: any = await (this.prisma as any).deliveryLink.create({
      data: {
        merchantId: merchant.id,
        deliveryZone: zone.id,
        paymentMethod: method,
        paidBy,
        tokenHash: hash,
        status: 'pending',
        expiresAt: new Date(Date.now() + LINK_TTL_MS),
        createdBy: merchantUserId,
      },
    });
    return {
      link: this.sanitize(row),
      url: this.linkUrl(raw),
      zone: { id: zone.id, label: zone.label, price: Number((zone as any).price) },
      merchantName: (merchant as any).businessName,
    };
  }

  /** Vista pública del link: comercio, barrio y precio (informativo). */
  async getPublic(rawToken: string) {
    const link = await this.findByToken(rawToken);
    if (!link) throw new NotFoundException('Link no encontrado');
    if (link.status === 'consumed' && link.orderId) {
      return { consumed: true as const, orderId: link.orderId };
    }
    if (link.status !== 'pending' || new Date(link.expiresAt).getTime() <= Date.now()) {
      throw new GoneException('Este link ya venció o fue usado');
    }
    const merchant: any = await this.prisma.merchantProfile.findUnique({
      where: { id: link.merchantId },
      select: { businessName: true, logoUrl: true, address: true, sinpeNumber: true, userId: true },
    });
    if (!merchant) throw new NotFoundException('Comercio no encontrado');
    const zone = await this.zoneById(link.deliveryZone).catch(() => null);
    // SINPE para que el cliente le pague directo al comercio (si no tiene
    // uno configurado, cae al teléfono de la cuenta).
    let sinpe: string | null = (merchant as any).sinpeNumber ?? null;
    if (!sinpe && (merchant as any).userId) {
      const u: any = await this.prisma.user.findUnique({
        where: { id: (merchant as any).userId },
        select: { phone: true },
      });
      sinpe = u?.phone ?? null;
    }
    return {
      consumed: false as const,
      merchantName: merchant.businessName,
      logoUrl: merchant.logoUrl ?? null,
      pickupAddress: merchant.address,
      deliveryZone: link.deliveryZone,
      zoneLabel: zone?.label ?? null,
      // Informativo: el precio real lo calcula el servidor al crear el pedido.
      price: zone ? Number((zone as any).price) : null,
      paymentMethod: link.paymentMethod,
      paidBy: (link as any).paidBy ?? 'merchant',
      sinpeNumber: sinpe,
      expiresAt: link.expiresAt,
    };
  }

  /** Links del comercio (para ver cuáles siguen abiertos). */
  async listMine(merchantUserId: string) {
    const merchant = await this.merchantOf(merchantUserId);
    const rows: any[] = await (this.prisma as any).deliveryLink.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return { links: rows.map((r) => this.sanitize(r)) };
  }

  /** Revoca un link pendiente del propio comercio. */
  async cancel(merchantUserId: string, id: string) {
    const merchant = await this.merchantOf(merchantUserId);
    const row: any = await (this.prisma as any).deliveryLink.findUnique({ where: { id } });
    if (!row || row.merchantId !== merchant.id) {
      throw new NotFoundException('Link no encontrado');
    }
    if (row.status !== 'pending') {
      throw new BadRequestException('Solo se puede revocar un link pendiente');
    }
    const updated: any = await (this.prisma as any).deliveryLink.update({
      where: { id },
      data: { status: 'cancelled' },
    });
    return { link: this.sanitize(updated) };
  }

  /**
   * El cliente envía sus datos: crea el pedido a nombre del comercio
   * (origen merchant_panel, el comercio paga el viaje con el método del
   * link) y consume el link de forma atómica. Reintentos con el mismo link
   * devuelven el pedido ya creado, nunca duplican.
   */
  async submit(rawToken: string, dto: SubmitDeliveryLinkDto, headerKey?: string) {
    const link = await this.findByToken(rawToken);
    if (!link) throw new NotFoundException('Link no encontrado');
    if (link.status === 'consumed' && link.orderId) {
      const order = await this.orderById(link.orderId);
      if (order) return { order, reused: true as const };
    }
    if (link.status !== 'pending' || new Date(link.expiresAt).getTime() <= Date.now()) {
      throw new GoneException('Este link ya venció o fue usado');
    }

    const merchant: any = await this.prisma.merchantProfile.findUnique({
      where: { id: link.merchantId },
    });
    if (!merchant) throw new NotFoundException('Comercio no encontrado');
    // El método pudo desactivarse después de crear el link: se revalida.
    this.assertMethodForMerchant(merchant, link.paymentMethod);
    const zone = await this.zoneById(link.deliveryZone);

    const customerName = String(dto?.customerName ?? '')
      .trim()
      .slice(0, 120);
    if (!customerName) throw new BadRequestException('customerName es requerido');
    const phone = normalizeCRPhone(dto?.customerPhone ?? '');
    if (!phone) {
      throw new BadRequestException('customerPhone es requerido (formato 8888-8888)');
    }
    const deliveryAddress = String(dto?.deliveryAddress ?? '').trim();
    if (!deliveryAddress) throw new BadRequestException('deliveryAddress es requerido');
    const packageDescription = String(dto?.packageDescription ?? '')
      .trim()
      .slice(0, 500);
    if (!packageDescription) {
      throw new BadRequestException('packageDescription es requerido (qué se envía)');
    }
    const idempotencyKey =
      (typeof headerKey === 'string' && headerKey.trim()) ||
      (typeof dto?.idempotencyKey === 'string' && dto.idempotencyKey.trim()) ||
      undefined;

    // Claim atómico: un solo submit gana; el resto ve el pedido creado.
    const claimed: any = await (this.prisma as any).deliveryLink.updateMany({
      where: {
        id: link.id,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      data: { status: 'consumed', consumedAt: new Date() },
    });
    if (claimed.count === 0) {
      const raced: any = await (this.prisma as any).deliveryLink.findUnique({
        where: { id: link.id },
      });
      if (raced?.status === 'consumed' && raced?.orderId) {
        const order = await this.orderById(raced.orderId);
        if (order) return { order, reused: true as const };
      }
      throw new ConflictException('Este link ya fue usado. Pedí uno nuevo al comercio.');
    }

    try {
      const order = await this.ordersService.create(merchant.userId, {
        kind: 'freight',
        origin: 'merchant_panel',
        orderType: 'immediate',
        paymentMethod: link.paymentMethod === 'cash' ? 'cash' : 'credit',
        pickupAddress: merchant.address,
        pickupLat: merchant.latitude,
        pickupLng: merchant.longitude,
        deliveryAddress,
        ...(dto?.deliveryLat != null && dto?.deliveryLng != null
          ? { deliveryLat: dto.deliveryLat, deliveryLng: dto.deliveryLng }
          : {}),
        deliveryZone: zone.id,
        items: [],
        productsTotal: 0,
        packageDescription,
        ...(dto?.packageSize != null ? { packageSize: dto.packageSize } : {}),
        ...(dto?.weightKg != null && dto?.weightKg !== '' ? { weightKg: dto.weightKg } : {}),
        customerName,
        customerPhone: phone,
        specialInstructions:
          String(dto?.specialInstructions ?? '').trim() ||
          `Pedido por link de ${merchant.businessName}`,
        ...(idempotencyKey ? { idempotencyKey: idempotencyKey.slice(0, 100) } : {}),
      });
      // Crédito y facturación semanal viajan como 'credit' en create()
      // (gatea awaiting_payment igual) y se cobran acá con su método real.
      if (link.paymentMethod === 'credit' || link.paymentMethod === 'weekly_invoice') {
        await this.paymentsService.createPayment(
          {
            orderId: order.id,
            method: link.paymentMethod as any,
            amount: Math.round(Number(order.basePrice)),
          } as any,
          merchant.userId,
          'merchant',
        );
      }
      await (this.prisma as any).deliveryLink.update({
        where: { id: link.id },
        data: { orderId: order.id },
      });
      return { order, reused: false as const };
    } catch (e) {
      // Falla a mitad de camino: se libera para reintentar. Si el pedido sí
      // quedó creado, el próximo intento lo encuentra por idempotencia.
      try {
        if (idempotencyKey) {
          const dupe: any = await (this.prisma.order as any).findFirst?.({
            where: { merchantId: merchant.id, idempotencyKey: idempotencyKey.slice(0, 100) },
            select: { id: true },
          });
          if (dupe) {
            await (this.prisma as any).deliveryLink.update({
              where: { id: link.id },
              data: { orderId: dupe.id },
            });
            const order = await this.orderById(dupe.id);
            if (order) return { order, reused: true as const };
          }
        }
        await (this.prisma as any).deliveryLink.updateMany({
          where: { id: link.id, status: 'consumed', orderId: null },
          data: { status: 'pending', consumedAt: null },
        });
      } catch {
        // best-effort: el 409 del reintento evita el duplicado igual
      }
      throw e;
    }
  }

  private async findByToken(rawToken: string) {
    if (typeof rawToken !== 'string' || rawToken.length < 32) return null;
    const hash = createHash('sha256').update(rawToken).digest('hex');
    return (this.prisma as any).deliveryLink.findUnique({ where: { tokenHash: hash } });
  }

  private async orderById(orderId: string) {
    try {
      return await this.prisma.order.findUnique({ where: { id: orderId } });
    } catch {
      return null;
    }
  }
}
