// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Trim antes de validar: MinLength debe medir contenido real, no espacios.
 * Sin esto, "   " (3 espacios) pasa MinLength(2) y "          " pasa
 * MinLength(10) — verificado en vivo contra la API. También arregla la UX
 * de "pegué mi email con un espacio al final".
 */
const trimmed = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/**
 * POST /contact body — formulario público de la landing (sin auth).
 * El middleware global de sanitization ya limpia patrones XSS; aquí solo
 * forma y tamaños. email y phone son opcionales PERO al menos uno es
 * requerido (se valida en el service — class-validator no tiene "oneOf").
 */
export class CreateContactMessageDto {
  @trimmed()
  @IsString()
  @MinLength(2, { message: 'name debe tener al menos 2 caracteres' })
  @MaxLength(80)
  name!: string;

  @trimmed()
  @IsOptional()
  @IsEmail({}, { message: 'email no es válido' })
  @MaxLength(120)
  email?: string;

  @trimmed()
  @IsOptional()
  @Matches(/^\+?[0-9\s-]{7,20}$/, { message: 'phone debe ser un teléfono válido' })
  phone?: string;

  @trimmed()
  @IsString()
  @IsIn(['general', 'merchant', 'driver', 'support'], {
    message: 'subject debe ser: general, merchant, driver o support',
  })
  subject!: string;

  @trimmed()
  @IsString()
  @MinLength(10, { message: 'message debe tener al menos 10 caracteres' })
  @MaxLength(2000)
  message!: string;
}
