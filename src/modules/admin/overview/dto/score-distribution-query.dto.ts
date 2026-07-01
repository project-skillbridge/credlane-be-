import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ScoreDistributionQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by talent track. Omit for All Tracks.',
  })
  @IsOptional()
  @IsString()
  track?: string;
}
