import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsOptional, IsUUID } from 'class-validator';

export class UpdateLocationDto {
  @ApiProperty({ example: 10.1483 })
  @IsLatitude({ message: 'lat fuera de rango (-90 a 90)' })
  lat: number;

  @ApiProperty({ example: -85.4527 })
  @IsLongitude({ message: 'lng fuera de rango (-180 a 180)' })
  lng: number;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  orderId?: string;
}
