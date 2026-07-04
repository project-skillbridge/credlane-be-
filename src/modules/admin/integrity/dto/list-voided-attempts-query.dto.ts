import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../users/dto/pagination.dto';
import { AssessmentType } from '../../../assessments/entities/assessment-question.entity';

export class ListVoidedAttemptsQueryDto extends PaginationDto {
  @ApiProperty({ required: false, enum: AssessmentType })
  @IsOptional()
  @IsEnum(AssessmentType)
  assessmentType?: AssessmentType;

  @ApiProperty({
    required: false,
    description: 'Search by talent name or email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, format: 'date' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({ required: false, format: 'date' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
