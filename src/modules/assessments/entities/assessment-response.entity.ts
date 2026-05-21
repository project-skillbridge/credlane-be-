import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssessmentAttempt } from './assessment-attempt.entity';
import { AssessmentQuestion } from './assessment-question.entity';

@Entity('assessment_responses')
export class AssessmentResponse {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  attempt_id: string;

  @ManyToOne(() => AssessmentAttempt)
  @JoinColumn({ name: 'attempt_id' })
  attempt: AssessmentAttempt;

  @ApiProperty({
    format: 'uuid',
    required: false,
    nullable: true,
    description: 'Null for advanced assessment (questions stored in attempt)',
  })
  @Column({ type: 'uuid', nullable: true })
  question_id: string | null;

  @ManyToOne(() => AssessmentQuestion, { nullable: true })
  @JoinColumn({ name: 'question_id' })
  question: AssessmentQuestion | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Question text for advanced assessment only',
  })
  @Column({ type: 'text', nullable: true })
  question_text: string | null;

  @ApiProperty({ description: 'User answer - can be string, array, or object' })
  @Column({ type: 'jsonb' })
  user_answer: any;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'For skill and advanced assessments only',
  })
  @Column({ type: 'boolean', nullable: true })
  is_correct: boolean | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'AI rubric evaluation JSON for text answers (advanced assessment)',
  })
  @Column({ type: 'jsonb', nullable: true })
  ai_evaluation_json: Record<string, unknown> | null;

  @ApiProperty()
  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  answered_at: Date;
}
