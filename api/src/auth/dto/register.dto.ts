import { IsEmail, IsString, MinLength, IsOptional, IsEnum, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@kiwi.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: '8888-8888' })
  @IsOptional()
  @IsString()
  @Matches(/^(\+506)?\s?\d{4}-?\d{4}$/, {
    message: 'Formato de teléfono inválido',
  })
  phone?: string;

  @ApiProperty({ example: 'Juan Carlos' })
  @IsString()
  fullName: string;

  @ApiProperty({ enum: ['merchant', 'driver'] })
  @IsEnum(['merchant', 'driver'])
  role: string;

  @ApiPropertyOptional({ example: 'Restaurante El Sabor' })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiPropertyOptional({ enum: ['motorcycle', 'motorized_bike', 'bicycle', 'car', 'truck'] })
  @IsOptional()
  @IsEnum(['motorcycle', 'motorized_bike', 'bicycle', 'car', 'truck'])
  vehicleType?: string;
}
