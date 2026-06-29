import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../users/dto/pagination.dto';

export const TRANSACTION_STATUS_FILTER_VALUES = [
  'successful',
  'failed',
  'refunded',
] as const;

export class ListTransactionsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TRANSACTION_STATUS_FILTER_VALUES })
  @IsOptional()
  @IsIn(TRANSACTION_STATUS_FILTER_VALUES)
  status?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Search by subscriber name' })
  @IsOptional()
  @IsString()
  search?: string;
}
