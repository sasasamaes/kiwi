// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { IsBoolean, IsObject, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Ofertas por app: { customer?: {title, detail}, driver?: {…}, merchant?: {…} }.
 * El servicio valida la forma; acá solo se exige objeto para no duplicar.
 */
export class UpsertReferralDto {
  @ApiProperty({ example: 'KIKO' })
  @IsString()
  @Matches(/^[A-Za-z0-9]{2,20}$/, { message: 'Código inválido (2-20 letras/números)' })
  code: string;

  @ApiPropertyOptional({
    example: { customer: { title: '₡2.000 de regalo', detail: 'En tu primer pedido' } },
  })
  @IsOptional()
  @IsObject()
  offers?: Record<string, { title?: string; detail?: string }>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
