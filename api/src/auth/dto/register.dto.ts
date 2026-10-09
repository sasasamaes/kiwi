// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { IsEmail, IsString, MinLength, IsOptional, IsEnum, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizeCRPhone } from '../../common/phone';

// Forms send "" for untouched optional inputs; IsOptional doesn't skip "",
// so normalize blanks to undefined before validation (else 400 on register).
const EmptyToUndefined = () =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value));

// El teléfono se acepta como lo escribe el usuario (+506 7219 9768,
// 72199768, 7219-9768) y se normaliza a la forma canónica 8888-8888 antes de
// validar y de guardar. Un solo formato evita falsos "formato inválido" y que
// la unique de phone trate el mismo número como dos cuentas distintas.
// Si no es un número CR válido se deja tal cual para que Matches() responda
// con el mensaje de siempre.
const NormalizePhone = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    return normalizeCRPhone(trimmed) ?? trimmed;
  });

export class RegisterDto {
  @ApiProperty({ example: 'user@kiwi.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: '8888-8888' })
  @NormalizePhone()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{4}$/, {
    message: 'Formato de teléfono inválido',
  })
  phone?: string;

  // Minimización (Ley 8968): el nombre personal solo lo necesita el
  // repartidor (es su nombre público ante comercios/clientes). El comercio
  // opera con businessName; no se le pide ni se guarda un nombre personal.
  @ApiPropertyOptional({ example: 'Juan Carlos', description: 'Solo para repartidores' })
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ enum: ['merchant', 'driver', 'customer'] })
  @IsEnum(['merchant', 'driver', 'customer'], {
    message: 'role debe ser "merchant" (comercio), "driver" (repartidor) o "customer" (cliente)',
  })
  role: string;

  @ApiPropertyOptional({ example: 'Restaurante El Sabor' })
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiPropertyOptional({ enum: ['motorcycle', 'motorized_bike', 'bicycle', 'car', 'truck'] })
  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(['motorcycle', 'motorized_bike', 'bicycle', 'car', 'truck'])
  vehicleType?: string;

  @ApiPropertyOptional({ example: 'nicoya', description: 'Ciudad operativa' })
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  citySlug?: string;

  @ApiPropertyOptional({ example: 'Centro, 100m norte del parque' })
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  defaultAddress?: string;
}
