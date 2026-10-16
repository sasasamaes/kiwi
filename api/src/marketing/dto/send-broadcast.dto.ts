// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendBroadcastDto {
  @ApiProperty({ enum: ['email', 'whatsapp', 'both'] })
  @IsIn(['email', 'whatsapp', 'both'])
  channel: string;

  @ApiProperty({ example: ['merchant'], description: 'Roles destino (usuarios registrados)' })
  @IsArray()
  @IsString({ each: true })
  roles: string[];

  @ApiPropertyOptional({ example: ['a@x.com'], description: 'Emails extra fuera de la base' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extraEmails?: string[];

  @ApiPropertyOptional({ example: ['8888-8888'], description: 'Teléfonos extra (WhatsApp)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extraPhones?: string[];

  @ApiProperty({ example: 'Cómo funciona Kiwi para tu comercio' })
  @IsString()
  @MaxLength(150)
  subject: string;

  @ApiProperty({ description: 'Cuerpo en texto plano ({{name}} y {{registerUrl}} se reemplazan)' })
  @IsString()
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({ description: 'Solo estos userIds (si no, toda la base del rol)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @ApiPropertyOptional({ example: false, description: 'Dry-run: cuenta destinatarios sin enviar' })
  @IsOptional()
  dryRun?: boolean;
}
