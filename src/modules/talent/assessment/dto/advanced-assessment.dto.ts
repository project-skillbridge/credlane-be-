import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
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
  questionId: string;

  @ApiProperty({ description: 'Seconds spent on this question' })
  @IsNumber()
  @Min(0)
  timeSpentSeconds: number;
}

export class AdvancedAnswerDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The question ID from the session questions array',
    example: '80967789-af3d-47c9-9e89-819e74719a06',
  })
  @IsUUID()
  @IsNotEmpty()
  questionId: string;

  @ApiProperty({
    description:
      'Answer as a plain string. For MCQ: the selected option text (e.g., "201 Created"). For text questions: your written answer. Multi-pick MCQs use string arrays.',
    examples: {
      'MCQ Answer': {
        value: '201 Created',
        description:
          'For single-pick MCQ questions, provide the exact option text',
      },
      'Text Answer': {
        value:
          'I would implement idempotency by using unique request IDs to track processed requests and prevent duplicate operations.',
        description:
          'For text questions, provide your answer as a string (10-600 chars for short_text, 60-2000 chars for long_text)',
      },
      'Multi-pick MCQ': {
        value: ['Option A', 'Option C'],
        description:
          'For multi-pick MCQ questions, provide an array of selected option texts',
      },
    },
    oneOf: [
      { type: 'string', description: 'Single answer (MCQ or text question)' },
      {
        type: 'array',
        items: { type: 'string' },
        description: 'Multiple answers (multi-pick MCQ only)',
      },
    ],
  })
  @IsNotEmpty()
  answer: string | string[];

  @ApiProperty({
    required: false,
    description:
      'Seconds spent on this question (used for abnormal timing detection). Long text answers spent in <5 seconds are flagged as abnormal.',
    example: 120,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpentSeconds?: number;
}

export {
  FlagIntegrityEventDto,
  IntegrityEventType,
} from './integrity-event.dto';

export class SubmitAdvancedAssessmentDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The session_id returned from POST /advanced/start',
    example: '1c47a4f6-d3ea-45fd-802f-a45859274736',
  })
  @IsUUID()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({
    type: [AdvancedAnswerDto],
    description:
      'Array of answers for all questions. Include only answered questions - unanswered questions are automatically scored as 0.',
    example: [
      {
        questionId: '80967789-af3d-47c9-9e89-819e74719a06',
        answer: '201 Created',
        timeSpentSeconds: 45,
      },
      {
        questionId: '0c32fe73-c79a-41ea-8d68-7027a1dd9bd2',
        answer:
          'I would implement idempotency by using a unique request ID parameter in the request header or body. The server stores processed request IDs in a cache or database with a TTL. When a request arrives, check if the ID exists - if yes, return the cached response; if no, process the request and store the ID with the response.',
        timeSpentSeconds: 120,
      },
      {
        questionId: 'abc12345-1234-5678-90ab-cdef12345678',
        answer: ['Option A', 'Option C', 'Option D'],
        timeSpentSeconds: 60,
      },
    ],
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
  questionId: string;

  @ApiProperty({
    description: 'Candidate\u2019s LT-2 answer text (60\u20132000 chars)',
    minLength: 60,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(60)
  @MaxLength(2000)
  answer: string;
}
