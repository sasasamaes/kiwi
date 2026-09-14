import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

const VEHICLE_TYPES = ['motorcycle', 'motorized_bike', 'bicycle', 'car', 'truck'] as const;

export class UpdateDriverProfileDto {
  @ApiPropertyOptional({ example: 'Juan Carlos' })
  @IsOptional()
  @IsString()
  @Length(3, 80)
  fullName?: string;

  @ApiPropertyOptional({ enum: VEHICLE_TYPES })
  @IsOptional()
  @IsEnum(VEHICLE_TYPES, { message: `vehicleType debe ser: ${VEHICLE_TYPES.join(', ')}` })
  vehicleType?: string;

  @ApiPropertyOptional({ example: 'ABC-123' })
  @IsOptional()
  @IsString()
  @Length(0, 20)
  @Matches(/^[A-Za-z0-9\- ]*$/, { message: 'Placa con caracteres inválidos' })
  vehiclePlate?: string;

  @ApiPropertyOptional({ example: 'https://example.com/foto.jpg' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  @Matches(/^https:\/\//, { message: 'photoUrl debe ser una URL https' })
  photoUrl?: string;
}
