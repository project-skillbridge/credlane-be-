import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const AI_GENERATION_PERIODS = [
  'yearly',
  'monthly',
  'weekly',
  'daily',
] as const;
export type AiGenerationPeriod = (typeof AI_GENERATION_PERIODS)[number];

export class AiGenerationConsumptionQueryDto {
  @ApiPropertyOptional({ enum: AI_GENERATION_PERIODS, default: 'monthly' })
  @IsOptional()
  @IsIn(AI_GENERATION_PERIODS)
  period?: AiGenerationPeriod = 'monthly';
}
