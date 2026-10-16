// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVisitDto } from './dto/create-visit.dto';

const OUTCOMES = ['pending', 'interested', 'invited', 'registered', 'not_interested'] as const;

/**
 * Visitas de venta en campo: qué negocio se visitó, con quién se habló, qué
 * se presentó y cuándo volver. El vendedor la carga desde el teléfono.
 */
@Injectable()
export class VisitsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateVisitDto, createdBy?: string) {
    const businessName = String(dto.businessName ?? '').trim();
    if (!businessName) throw new BadRequestException('Falta el nombre del negocio');
    const row: any = await (this.prisma as any).salesVisit.create({
      data: {
        businessName,
        contactName: dto.contactName?.trim() || undefined,
        email: dto.email?.trim().toLowerCase() || undefined,
        phone: dto.phone?.trim() || undefined,
        address: dto.address?.trim() || undefined,
        outcome: OUTCOMES.includes(dto.outcome as any) ? dto.outcome : 'pending',
        notes: dto.notes?.trim() || undefined,
        followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : undefined,
        invitationId: dto.invitationId?.trim() || undefined,
        createdBy,
      },
    });
    return { visit: row };
  }

  async list(params: {
    outcome?: string;
    search?: string;
    followUp?: string;
    take?: number;
    skip?: number;
  }) {
    const where: any = {};
    if (OUTCOMES.includes(params.outcome as any)) where.outcome = params.outcome;
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { businessName: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (params.followUp === 'due') {
      where.followUpAt = { lte: new Date() };
      where.outcome = { notIn: ['registered', 'not_interested'] };
    }
    const take = Math.min(Math.max(Number(params.take) || 50, 1), 100);
    const skip = Math.max(Number(params.skip) || 0, 0);
    const [rows, total] = await Promise.all([
      (this.prisma as any).salesVisit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      (this.prisma as any).salesVisit.count({ where }),
    ]);
    return { visits: rows, total };
  }

  async update(id: string, dto: CreateVisitDto) {
    const row: any = await (this.prisma as any).salesVisit.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Visita no encontrada');
    const data: any = {};
    if (dto.businessName !== undefined) data.businessName = String(dto.businessName).trim();
    if (dto.contactName !== undefined) data.contactName = dto.contactName?.trim() || null;
    if (dto.email !== undefined) data.email = dto.email?.trim().toLowerCase() || null;
    if (dto.phone !== undefined) data.phone = dto.phone?.trim() || null;
    if (dto.address !== undefined) data.address = dto.address?.trim() || null;
    if (dto.outcome !== undefined && OUTCOMES.includes(dto.outcome as any)) {
      data.outcome = dto.outcome;
    }
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.followUpAt !== undefined) {
      data.followUpAt = dto.followUpAt ? new Date(dto.followUpAt) : null;
    }
    if (dto.invitationId !== undefined) data.invitationId = dto.invitationId?.trim() || null;
    const updated: any = await (this.prisma as any).salesVisit.update({ where: { id }, data });
    return { visit: updated };
  }

  async remove(id: string) {
    const row: any = await (this.prisma as any).salesVisit.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Visita no encontrada');
    await (this.prisma as any).salesVisit.delete({ where: { id } });
    return { deleted: true };
  }
}
