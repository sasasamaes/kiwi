// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizeCRPhone } from '../../common/phone';

// Igual que el registro: "" de formularios intactos se vuelve undefined y el
// teléfono se normaliza a 8888-8888 antes de validar.
const EmptyToUndefined = () =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value));

const NormalizePhone = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    return normalizeCRPhone(trimmed) ?? trimmed;
  });

export class CreateInvitationDto {
  @ApiProperty({ example: 'soda@ejemplo.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @ApiPropertyOptional({ example: '8888-8888', description: 'Teléfono de contacto (opcional)' })
  @NormalizePhone()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{4}$/, {
    message: 'Formato de teléfono inválido',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: 'Soda El Sabor',
    description: 'Nombre del negocio (comercio) o de la persona (repartidor)',
  })
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ enum: ['merchant', 'driver'] })
  @IsEnum(['merchant', 'driver'], {
    message: 'role debe ser "merchant" (comercio) o "driver" (repartidor)',
  })
  role: string;
}
