import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StartSkillAssessmentDto {}

export class SkillAnswerDto {
  @ApiProperty({
    format: 'uuid',
    description: 'UUID of the AssessmentQuestion being answered',
  })
  @IsUUID()
  @IsNotEmpty()
  question_id: string;

  @ApiProperty({
    description:
      'The candidate answer. For MCQ (single_pick / multi_pick) send the selected option string or array of strings. For text questions (required_text / optional_text) send a plain string.',
    examples: {
      mcq: { value: 'React hooks' },
      text: { value: 'I would approach this by...' },
    },
  })
  @IsNotEmpty()
  answer: string | string[];
}

export class SubmitSkillAssessmentDto {
  @ApiProperty({ format: 'uuid', description: 'The active attempt session ID' })
  @IsUUID()
  @IsNotEmpty()
  attempt_id: string;

  @ApiProperty({
    type: [SkillAnswerDto],
    description: 'One entry per question in the session',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SkillAnswerDto)
  answers: SkillAnswerDto[];
}
