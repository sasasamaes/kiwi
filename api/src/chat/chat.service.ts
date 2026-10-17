// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface ChatParticipant {
  userId: string;
  role: 'merchant' | 'driver' | 'customer';
}

export interface ChatMessage {
  id: string;
  orderId: string;
  senderId: string;
  senderRole: string | null;
  text: string;
  createdAt: Date;
  mine: boolean;
}

/**
 * Chat del pedido entre comercio, repartidor asignado y cliente dueño.
 * Alcance: SOLO participantes de la orden (el link público de tracking no
 * chatea; invitados sin cuenta usan el teléfono visible).
 *
 * Almacenamiento: filas Notification type='chat' (una por destinatario, con
 * messageId común). El historial se lee por orden (no por destinatario)
 * para que quien se suma tarde (driver asignado después) vea todo.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** Participantes con cuenta: dueño comercio + driver asignado + cliente dueño. */
  async participants(orderId: string): Promise<{ order: any; members: ChatParticipant[] }> {
    const order: any = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        merchant: { select: { userId: true } },
        driver: { select: { userId: true } },
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    const members: ChatParticipant[] = [];
    if (order.merchant?.userId) members.push({ userId: order.merchant.userId, role: 'merchant' });
    if (order.driver?.userId) members.push({ userId: order.driver.userId, role: 'driver' });
    if (order.customerId) {
      try {
        const cu: any = await this.prisma.user.findUnique({
          where: { id: order.customerId },
          select: { id: true, status: true },
        });
        if (cu && (cu.status ?? 'active') === 'active') {
          members.push({ userId: order.customerId, role: 'customer' });
        }
      } catch {
        // best-effort: sin cliente legible, el chat sigue entre los demás
      }
    }
    return { order, members };
  }

  private assertParticipant(members: ChatParticipant[], senderId: string): void {
    if (!members.some((m) => m.userId === senderId)) {
      throw new ForbiddenException('Solo los participantes del pedido pueden chatear');
    }
  }

  async sendMessage(
    orderId: string,
    senderId: string,
    senderRole: string,
    rawText: unknown,
    emit?: (userId: string, payload: any) => void,
  ): Promise<{ message: Omit<ChatMessage, 'mine'>; delivered: number }> {
    const text = String(rawText ?? '')
      .trim()
      .slice(0, 1000);
    if (!orderId || !text) {
      throw new BadRequestException('orderId y text son requeridos');
    }
    const { members } = await this.participants(orderId);
    this.assertParticipant(members, senderId);
    const recipients = members.filter((m) => m.userId !== senderId);
    const messageId = randomUUID();
    const createdAt = new Date();

    // Una fila por destinatario (bandeja de cada uno) con messageId común
    // para deduplicar el historial del emisor.
    const rows: any[] = [];
    for (const r of recipients) {
      try {
        const row: any = await this.prisma.notification.create({
          data: {
            userId: r.userId,
            title: 'Nuevo mensaje',
            body: text,
            type: 'chat',
            data: { orderId, senderId, senderRole, messageId },
          },
        });
        rows.push(row);
      } catch (error) {
        this.logger.warn(`Chat inbox falló para ${r.userId}: ${(error as Error)?.message}`);
      }
    }

    const payload = {
      id: rows[0]?.id ?? messageId,
      orderId,
      senderId,
      senderRole,
      text,
      createdAt,
      messageId,
    };
    let delivered = 0;
    for (const r of recipients) {
      try {
        emit?.(r.userId, payload);
        delivered++;
      } catch {
        // el inbox ya quedó; el socket es best-effort
      }
      // Push para el que está offline (best-effort, nunca bloquea).
      try {
        await this.notifications.pushChatMessage(r.userId, {
          orderId,
          senderId,
          senderRole,
          text,
          messageId,
        });
      } catch (error) {
        this.logger.warn(`Chat push falló para ${r.userId}: ${(error as Error)?.message}`);
      }
    }
    return {
      message: {
        id: payload.id,
        orderId,
        senderId,
        senderRole,
        text,
        createdAt,
      },
      delivered,
    };
  }

  async getMessages(
    orderId: string,
    userId: string,
    limit = 50,
  ): Promise<{ messages: ChatMessage[]; participants: Array<{ role: string; present: boolean }> }> {
    const { order, members } = await this.participants(orderId);
    this.assertParticipant(members, userId);

    const rows: any[] = await this.prisma.notification.findMany({
      where: { type: 'chat', data: { path: ['orderId'], equals: orderId } },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 200),
    });

    // Deduplicar copias por destinatario (misma messageId).
    const seen = new Map<string, any>();
    for (const m of rows) {
      const key = m.data?.messageId ?? m.id;
      if (!seen.has(key)) seen.set(key, m);
    }
    const messages: ChatMessage[] = [...seen.values()].map((m: any) => ({
      id: m.data?.messageId ?? m.id,
      orderId,
      senderId: m.data?.senderId ?? null,
      senderRole: m.data?.senderRole ?? null,
      text: m.body,
      createdAt: m.createdAt,
      mine: (m.data?.senderId ?? null) === userId,
    }));

    void order;
    const present = new Set(members.map((m) => m.role));
    return {
      messages,
      participants: (['merchant', 'driver', 'customer'] as const).map((role) => ({
        role,
        present: present.has(role),
      })),
    };
  }
}
