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
  Min,
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
