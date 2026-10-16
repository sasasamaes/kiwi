// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizeCRPhone } from '../../common/phone';

const EmptyToUndefined = () =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value));

const NormalizePhone = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    return normalizeCRPhone(trimmed) ?? trimmed;
  });

export class CreateVisitDto {
  @ApiProperty({ example: 'Soda El Sabor' })
  @IsString()
  @MaxLength(120)
  businessName: string;

  @ApiPropertyOptional({ example: 'María' })
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @ApiPropertyOptional({ example: 'soda@ejemplo.com' })
  @EmptyToUndefined()
  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;

  @ApiPropertyOptional({ example: '8888-8888' })
  @NormalizePhone()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{4}$/, { message: 'Formato de teléfono inválido' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Centro, 100m norte del parque' })
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({
    enum: ['pending', 'interested', 'invited', 'registered', 'not_interested'],
  })
  @IsOptional()
  @IsIn(['pending', 'interested', 'invited', 'registered', 'not_interested'])
  outcome?: string;

  @ApiPropertyOptional({ description: 'Qué se habló / qué presentar la próxima' })
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ example: '2026-10-20', description: 'Cuándo volver (YYYY-MM-DD)' })
  @EmptyToUndefined()
  @IsOptional()
  @IsDateString({}, { message: 'Fecha de seguimiento inválida' })
  followUpAt?: string;

  @ApiPropertyOptional({ description: 'Id de la invitación si se dejó una' })
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  invitationId?: string;
}
