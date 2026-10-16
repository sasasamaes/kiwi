// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateZoneDto {
  @IsString()
  label!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  latitude?: number | null;

  @IsOptional()
  @IsNumber()
  longitude?: number | null;

  /** GeoJSON Polygon/MultiPolygon (se valida la forma en el service). */
  @IsOptional()
  @IsObject()
  geometry?: any;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateZoneDto extends PartialType(CreateZoneDto) {}
