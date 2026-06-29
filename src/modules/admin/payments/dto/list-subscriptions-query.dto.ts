import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../users/dto/pagination.dto';

export const SUBSCRIPTION_TYPE_VALUES = ['employer', 'talent'] as const;
export const SUBSCRIPTION_STATUS_VALUES = [
  'active',
  'past_due',
  'cancelled',
  'free',
] as const;

export class ListSubscriptionsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SUBSCRIPTION_TYPE_VALUES })
  @IsOptional()
  @IsIn(SUBSCRIPTION_TYPE_VALUES)
  type?: 'employer' | 'talent';

  @ApiPropertyOptional({ enum: SUBSCRIPTION_STATUS_VALUES })
  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUS_VALUES)
  status?: string;

  @ApiPropertyOptional({ description: 'Search by subscriber name' })
  @IsOptional()
  @IsString()
  search?: string;
}
