import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VerifiedLevel } from '../../assessments/entities/assessment-question.entity';
import { PaginationDto } from '../../users/dto/pagination.dto';

const TIER_VALUES = ['job_ready'] as const;

const AVAILABILITY_VALUES = [
  'immediately_available',
  'on_notice_under_1_month',
  'on_notice_1_3_months',
  'employed_flexible',
] as const;

const EXPERIENCE_LEVEL_VALUES = [
  VerifiedLevel.JUNIOR,
  VerifiedLevel.MID,
  VerifiedLevel.SENIOR,
  VerifiedLevel.EXPERT,
] as const;

export class DiscoveryCandidatesQueryDto extends PaginationDto {
  @ApiProperty({ required: false, description: 'Filter by role track slug' })
  @IsOptional()
  @IsString()
  roleTrack?: string;

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

  @ApiProperty({
    required: false,
    minimum: 0,
    maximum: 100,
    description: 'Minimum composite score (inclusive)',
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @ApiProperty({
    required: false,
    minimum: 0,
    maximum: 100,
    description: 'Maximum composite score (inclusive)',
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  @Max(100)
  maxScore?: number;

  @ApiProperty({
    required: false,
    enum: EXPERIENCE_LEVEL_VALUES,
    description: 'Filter by validated experience level',
  })
  @IsOptional()
  @IsIn(EXPERIENCE_LEVEL_VALUES, { message: 'Invalid experience level' })
  experienceLevel?: VerifiedLevel;

  @ApiProperty({
    required: false,
    description: 'Filter by region or country (partial match)',
    example: 'Nigeria',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;
}
