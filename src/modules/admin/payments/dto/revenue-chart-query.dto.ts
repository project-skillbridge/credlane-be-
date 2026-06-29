import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const REVENUE_PERIOD_VALUES = [
  'yearly',
  'monthly',
  'weekly',
  'daily',
] as const;

export class RevenueChartQueryDto {
  @ApiPropertyOptional({ enum: REVENUE_PERIOD_VALUES, default: 'monthly' })
  @IsOptional()
  @IsIn(REVENUE_PERIOD_VALUES)
  period?: 'yearly' | 'monthly' | 'weekly' | 'daily';
}
