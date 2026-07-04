import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../users/dto/pagination.dto';
import {
  AssessmentType,
  VerifiedLevel,
} from '../../../assessments/entities/assessment-question.entity';
import { TALENT_ROLE_TRACKS } from '../../../talent/talent.constants';

export class ListQuestionsQueryDto extends PaginationDto {
  @ApiProperty({ required: false, enum: AssessmentType })
  @IsOptional()
  @IsEnum(AssessmentType)
  assessmentType?: AssessmentType;

  @ApiProperty({ required: false, enum: TALENT_ROLE_TRACKS })
  @IsOptional()
  @IsIn(TALENT_ROLE_TRACKS as readonly string[])
  track?: string;

  @ApiProperty({ required: false, enum: VerifiedLevel })
  @IsOptional()
  @IsEnum(VerifiedLevel)
  verifiedLevel?: VerifiedLevel;

  @ApiProperty({ required: false, description: 'Search question text' })
  @IsOptional()
  @IsString()
  search?: string;
}
