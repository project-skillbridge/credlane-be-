import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../users/dto/pagination.dto';

const TIER_VALUES = ['job_ready'] as const;

const AVAILABILITY_VALUES = [
  'immediately_available',
  'on_notice_under_1_month',
  'on_notice_1_3_months',
  'employed_flexible',
] as const;

export class DiscoveryCandidatesQueryDto extends PaginationDto {
  @ApiProperty({ required: false, description: 'Filter by role track' })
  @IsOptional()
  @IsString()
  role_track?: string;

  @ApiProperty({
    required: false,
    enum: TIER_VALUES,
    description: 'Filter by score tier (only job_ready exposed)',
  })
  @IsOptional()
  @IsIn(TIER_VALUES, { message: 'tier must be job_ready' })
  tier?: string;

  @ApiProperty({
    required: false,
    enum: AVAILABILITY_VALUES,
    description: 'Filter by availability',
  })
  @IsOptional()
  @IsIn(AVAILABILITY_VALUES, {
    message: 'Invalid availability value',
  })
  availability?: string;

  @ApiProperty({ required: false, description: 'Search by candidate name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
