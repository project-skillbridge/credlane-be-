import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class AdminOffersStatsQueryDto {
  @ApiPropertyOptional({
    description:
      'Start of the date range (ISO 8601). Defaults to 30 days ago when omitted.',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description:
      'End of the date range (ISO 8601). Defaults to now when omitted.',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
