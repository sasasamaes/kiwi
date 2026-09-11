import { IsInt, IsOptional, IsString, Max, Min, MaxLength, IsBoolean } from 'class-validator';

/**
 * POST /ratings body — merchant rates the driver of a delivered order.
 */
export class CreateRatingDto {
  @IsString()
  orderId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @IsOptional()
  @IsBoolean()
  onTime?: boolean;

  @IsOptional()
  @IsBoolean()
  carefulWithOrder?: boolean;
}
