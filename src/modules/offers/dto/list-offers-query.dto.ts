import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../users/dto/pagination.dto';

const OFFER_STATUS_VALUES = [
  'pending',
  'accepted',
  'declined',
  'expired',
] as const;

type OfferStatusFilter = (typeof OFFER_STATUS_VALUES)[number];

export class ListOffersQueryDto extends PaginationDto {
  @ApiProperty({
    required: false,
    enum: OFFER_STATUS_VALUES,
    description: 'Filter by offer status',
  })
  @IsOptional()
  @IsIn(OFFER_STATUS_VALUES)
  status?: OfferStatusFilter;
}
