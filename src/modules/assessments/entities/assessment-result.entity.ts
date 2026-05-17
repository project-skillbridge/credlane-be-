import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssessmentAttempt } from './assessment-attempt.entity';
import { SkillLevel } from './assessment-question.entity';

export enum AssessmentTier {
  NOT_READY = 'not_ready',
  EMERGING = 'emerging',
  JOB_READY = 'job_ready',
}

@Entity('assessment_results')
export class AssessmentResult {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid', unique: true })
  attempt_id: string;

  @OneToOne(() => AssessmentAttempt)
  @JoinColumn({ name: 'attempt_id' })
  attempt: AssessmentAttempt;

  @ApiProperty({
    description: 'Score out of total questions (e.g., 7/10 or 75/100)',
  })
  @Column({ type: 'integer' })
  score: number;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: AssessmentTier,
    description: 'Final tier for advanced assessment only',
  })
  @Column({ type: 'enum', enum: AssessmentTier, nullable: true })
  tier: AssessmentTier | null;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: SkillLevel,
    description: 'Validated level for skill assessment only',
  })
  @Column({ type: 'enum', enum: SkillLevel, nullable: true })
  validated_level: SkillLevel | null;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
