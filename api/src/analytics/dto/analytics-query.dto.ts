// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { IsOptional, IsEnum, IsDateString } from 'class-validator';

export enum AnalyticsPeriod {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
  CUSTOM = 'custom',
}

export enum AnalyticsMetric {
  REVENUE = 'revenue',
  ORDERS = 'orders',
  DRIVERS = 'drivers',
  CUSTOMERS = 'customers',
  ALL = 'all',
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod = AnalyticsPeriod.WEEK;

  @IsOptional()
  @IsEnum(AnalyticsMetric)
  metric?: AnalyticsMetric = AnalyticsMetric.ALL;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  groupBy?: 'day' | 'week' | 'month' = 'day';
}
