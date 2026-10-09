// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { IsString, IsOptional, IsIn, IsDateString, IsUrl, MaxLength } from 'class-validator';

export class DiscoverQueryDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  take?: string;
}

export class CreateCampaignDto {
  @IsIn(['spotlight', 'banner'])
  type!: 'spotlight' | 'banner';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  citySlug?: string;
}

export class CreateBroadcastDto {
  @IsString()
  @MaxLength(60)
  title!: string;

  @IsString()
  @MaxLength(140)
  body!: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  citySlug?: string;

  @IsOptional()
  @IsString()
  zoneId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class RecordAdEventDto {
  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  broadcastId?: string;

  @IsIn(['impression', 'click', 'push_open'])
  type!: string;
}
