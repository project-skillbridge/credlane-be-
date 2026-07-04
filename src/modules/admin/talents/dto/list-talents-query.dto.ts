import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../users/dto/pagination.dto';
import { TalentProfileStatus } from '../../../talent/entities/talent-profile.entity';

/** Spec's Talents-page Tier filter: Rejected | Emerging | Job Ready. */
export const TALENT_TIER_FILTER_VALUES = [
  TalentProfileStatus.NOT_READY,
  TalentProfileStatus.EMERGING,
  TalentProfileStatus.JOB_READY,
] as const;

export class ListTalentsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by talent track' })
  @IsOptional()
  @IsString()
  track?: string;

  @ApiPropertyOptional({ enum: TALENT_TIER_FILTER_VALUES })
  @IsOptional()
  @IsIn(TALENT_TIER_FILTER_VALUES)
  tier?: TalentProfileStatus;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  scoreMin?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  scoreMax?: number;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Search by name or email' })
  @IsOptional()
  @IsString()
  search?: string;
}
