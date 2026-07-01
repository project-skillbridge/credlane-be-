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
  assessment_type: AssessmentType;

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  question_type: QuestionType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  question_text: string;

  @ApiProperty({ enum: TALENT_ROLE_TRACKS })
  @IsIn(TALENT_ROLE_TRACKS as readonly string[])
  track: string;

  @ApiProperty({ enum: VerifiedLevel })
  @IsEnum(VerifiedLevel)
  verified_level: VerifiedLevel;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  options?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  correct_answer?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  competency?: string;

  @ApiProperty({ required: false, enum: SlotType })
  @IsOptional()
  @IsEnum(SlotType)
  slot_type?: SlotType;
}
