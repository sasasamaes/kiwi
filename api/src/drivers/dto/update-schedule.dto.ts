// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleEntryDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: '2026-09-13T08:00:00.000Z' })
  @IsDateString({}, { message: 'startTime debe ser ISO8601' })
  startTime: string;

  @ApiProperty({ example: '2026-09-13T17:00:00.000Z' })
  @IsDateString({}, { message: 'endTime debe ser ISO8601' })
  endTime: string;
}

export class UpdateScheduleDto {
  @ApiProperty({ type: [ScheduleEntryDto] })
  @IsArray()
  @ArrayMaxSize(21, { message: 'Máximo 21 bloques de horario (3 turnos × 7 días)' })
  @ValidateNested({ each: true })
  @Type(() => ScheduleEntryDto)
  schedules: ScheduleEntryDto[];
}
