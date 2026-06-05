import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StartSkillAssessmentDto {}

export class SkillAnswerDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The question ID from the session questions array',
    example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
  })
  @IsUUID()
  @IsNotEmpty()
  questionId: string;

  @ApiProperty({
    description:
      'Answer as a plain string or array of strings. For single-pick MCQ: the selected option text (e.g., "React hooks"). For multi-pick MCQ: array of selected option texts.',
    examples: {
      'Single-Pick MCQ': {
        value: 'React hooks',
        description:
          'For single-pick MCQ questions (question_type: "single_pick"), provide the exact option text as a string',
      },
      'Multi-Pick MCQ': {
        value: ['JavaScript', 'TypeScript', 'Python'],
        description:
          'For multi-pick MCQ questions (question_type: "multi_pick"), provide an array of selected option texts',
      },
    },
    oneOf: [
      {
        type: 'string',
        description: 'Single answer (single-pick MCQ or text question)',
      },
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
      'Seconds spent on this question (optional, used for analytics)',
    example: 45,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpentSeconds?: number;
}

export class SubmitSkillAssessmentDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'The attempt_id returned from POST /talent/assessment/skill/start',
    example: '9876fedc-ba98-7654-3210-fedcba987654',
  })
  @IsUUID()
  @IsNotEmpty()
  attemptId: string;

  @ApiProperty({
    type: [SkillAnswerDto],
    description:
      'Array of answers for all questions in the session. Include one entry per question.',
    example: [
      {
        questionId: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
        answer: 'React hooks',
        timeSpentSeconds: 30,
      },
      {
        questionId: 'b2c3d4e5-6789-01bc-def0-234567890abc',
        answer: ['JavaScript', 'TypeScript'],
        timeSpentSeconds: 45,
      },
      {
        questionId: 'c3d4e5f6-7890-12cd-ef01-34567890abcd',
        answer:
          'I would approach this problem by analyzing the requirements first, then designing a solution that scales well.',
        timeSpentSeconds: 90,
      },
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SkillAnswerDto)
  answers: SkillAnswerDto[];
}
