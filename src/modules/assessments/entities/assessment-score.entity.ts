import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssessmentAttempt } from './assessment-attempt.entity';

/**
 * Per-question score row for a completed assessment attempt.
 *
 * Dedicated table for scored question outputs so the employer-facing
 * competency breakdown, integrity audits, and per-competency analytics
 * can be queried directly without joining or parsing jsonb.
 *
 * Populated by AdvancedAssessmentService.submit() — one row per session
 * question (MCQ rows have ai_evaluation_json = null; text rows carry the full
 * rubric breakdown). AssessmentResponse remains the source of truth for the
 * raw candidate answer; this table is the scored projection on top of it.
 */
export enum AssessmentScoreQuestionType {
  MCQ = 'mcq',
  SHORT_TEXT = 'short_text',
  LONG_TEXT = 'long_text',
}

export type IntegrityConfidenceLevel = 'high' | 'medium' | 'low';

@Entity('assessment_scores')
@Index('idx_assessment_scores_attempt', ['attempt_id'])
@Index('idx_assessment_scores_talent', ['talent_profile_id'])
@Index('idx_assessment_scores_competency', ['competency'])
export class AssessmentScore {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  attempt_id: string;

  @ManyToOne(() => AssessmentAttempt, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attempt_id' })
  attempt: AssessmentAttempt;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  talent_profile_id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  question_id: string;

  @ApiProperty({ enum: AssessmentScoreQuestionType })
  @Column({ type: 'varchar', length: 20 })
  question_type: AssessmentScoreQuestionType;

  @ApiProperty({ description: 'Points awarded for this question' })
  @Column({ type: 'float' })
  raw_score: number;

  @ApiProperty({ description: 'Maximum possible points for this question' })
  @Column({ type: 'float' })
  max_score: number;

  @ApiProperty({ description: 'raw_score / max_score * 100' })
  @Column({ type: 'float' })
  pct_score: number;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Competency tag from the question metadata (track taxonomy)',
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  competency: string | null;

  @ApiProperty({
    default: false,
    description: 'True when this specific answer triggered an integrity event',
  })
  @Column({ type: 'boolean', default: false })
  integrity_flag: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'high | medium | low',
  })
  @Column({ type: 'varchar', length: 10, nullable: true })
  integrity_confidence: IntegrityConfidenceLevel | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Full AI rubric breakdown for text answers; null for MCQ',
  })
  @Column({ type: 'jsonb', nullable: true })
  ai_evaluation_json: Record<string, unknown> | null;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
