import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  AssessmentType,
  QuestionType,
  SlotType,
  VerifiedLevel,
} from '../../../assessments/entities/assessment-question.entity';
import { TALENT_ROLE_TRACKS } from '../../../talent/talent.constants';

export class AddQuestionDto {
  @ApiProperty({ enum: AssessmentType })
  @IsEnum(AssessmentType)
  assessmentType: AssessmentType;

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  questionType: QuestionType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  questionText: string;

  @ApiProperty({ enum: TALENT_ROLE_TRACKS })
  @IsIn(TALENT_ROLE_TRACKS as readonly string[])
  track: string;

  @ApiProperty({ enum: VerifiedLevel })
  @IsEnum(VerifiedLevel)
  verifiedLevel: VerifiedLevel;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  options?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  competency?: string;

  @ApiProperty({ required: false, enum: SlotType })
  @IsOptional()
  @IsEnum(SlotType)
  slotType?: SlotType;
}
