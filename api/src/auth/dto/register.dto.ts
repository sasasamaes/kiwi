import { IsEmail, IsString, MinLength, IsOptional, IsEnum, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Forms send "" for untouched optional inputs; IsOptional doesn't skip "",
// so normalize blanks to undefined before validation (else 400 on register).
const EmptyToUndefined = () =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value));

export class RegisterDto {
  @ApiProperty({ example: 'user@kiwi.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: '8888-8888' })
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @Matches(/^(\+506)?\s?\d{4}-?\d{4}$/, {
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

  @ApiProperty({ enum: ['merchant', 'driver'] })
  @IsEnum(['merchant', 'driver'], {
    message: 'role debe ser "merchant" (comercio) o "driver" (repartidor)',
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
}
