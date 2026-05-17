import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TalentProfile } from '../../talent/entities/talent-profile.entity';
import { AssessmentQuestion } from './assessment-question.entity';
import { AssessmentAttempt } from './assessment-attempt.entity';

@Entity('talent_question_history')
export class TalentQuestionHistory {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  talent_profile_id: string;

  @ManyToOne(() => TalentProfile)
  @JoinColumn({ name: 'talent_profile_id' })
  talent_profile: TalentProfile;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  question_id: string;

  @ManyToOne(() => AssessmentQuestion)
  @JoinColumn({ name: 'question_id' })
  question: AssessmentQuestion;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  attempt_id: string;

  @ManyToOne(() => AssessmentAttempt)
  @JoinColumn({ name: 'attempt_id' })
  attempt: AssessmentAttempt;

  @ApiProperty({ description: 'The actual answer provided' })
  @Column({ type: 'jsonb' })
  user_answer: any;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Whether answer was correct (null for subjective questions)',
  })
  @Column({ type: 'boolean', nullable: true })
  is_correct: boolean | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Raw points earned for this answer',
  })
  @Column({ type: 'float', nullable: true })
  raw_score: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Maximum possible points for this question',
  })
  @Column({ type: 'float', nullable: true })
  max_score: number | null;

  @ApiProperty()
  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  answered_at: Date;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
