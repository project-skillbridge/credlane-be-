import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StartAdvancedAssessmentDto {}

export class AdvancedAnswerTimingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  question_id: string;

  @ApiProperty({ description: 'Seconds spent on this question' })
  @IsNumber()
  @Min(0)
  time_spent_seconds: number;
}

export class AdvancedAnswerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  question_id: string;

  @ApiProperty({
    description: 'Answer string or array of strings for MCQ multi-pick',
  })
  @IsNotEmpty()
  answer: string | string[];

  @ApiProperty({
    required: false,
    description: 'Seconds spent on this question (used for abnormal timing detection)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  time_spent_seconds?: number;
}

export enum IntegrityEventType {
  TAB_SWITCH = 'tab_switch',
  COPY_PASTE = 'copy_paste',
}

export class FlagIntegrityEventDto {
  @ApiProperty({ enum: IntegrityEventType })
  @IsEnum(IntegrityEventType)
  event_type: IntegrityEventType;

  @ApiProperty({ required: false, description: 'Additional context' })
  @IsOptional()
  @IsString()
  context?: string;
}

export class SubmitAdvancedAssessmentDto {
  @ApiProperty({ format: 'uuid', description: 'The active session ID' })
  @IsUUID()
  @IsNotEmpty()
  session_id: string;

  @ApiProperty({
    type: [AdvancedAnswerDto],
    description: 'One entry per question answered. Unanswered questions are scored 0.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AdvancedAnswerDto)
  answers: AdvancedAnswerDto[];
}

/**
 * LT-3 (reflection) is generated at runtime from the candidate's LT-2
 * answer and served immediately after LT-2 submission. Client posts the
 * LT-2 answer here; server returns the generated LT-3.
 */
export class SubmitLt2Dto {
  @ApiProperty({
    format: 'uuid',
    description: 'The LT-2 (WORK_TASK) question_id from the session payload',
  })
  @IsUUID()
  @IsNotEmpty()
  question_id: string;

  @ApiProperty({
    description: 'Candidate\u2019s LT-2 answer text (150\u20132000 chars)',
    minLength: 150,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(150)
  @MaxLength(2000)
  answer: string;
}
