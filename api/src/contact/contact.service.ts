import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContactMessageDto) {
    // Al menos un canal de respuesta: sin esto un mensaje no es respondible.
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Incluye un email o un teléfono para poder responderte');
    }

    // Anti-duplicado simple: mismo remitente + mismo texto en los últimos
    // 10 minutos no se guarda dos veces (doble-click, retry del cliente).
    const recent = await this.prisma.contactMessage.findFirst({
      where: {
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        OR: [
          ...(dto.email ? [{ email: dto.email }] : []),
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
        message: dto.message,
      },
      select: { id: true },
    });
    if (recent) {
      return { ok: true, duplicate: true as const };
    }

    // El DTO ya entrega todo trim-eado (Transform antes de validar).
    const created = await this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        subject: dto.subject,
        message: dto.message,
      },
      select: { id: true, createdAt: true },
    });

    return { ok: true, duplicate: false as const, id: created.id };
  }
}
