import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TalentProfile } from '../../talent/entities/talent-profile.entity';
import { AssessmentType } from './assessment-question.entity';

@Entity('assessment_attempts')
export class AssessmentAttempt {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  talent_profile_id: string;

  @ManyToOne(() => TalentProfile)
  @JoinColumn({ name: 'talent_profile_id' })
  talent_profile: TalentProfile;

  @ApiProperty({ enum: AssessmentType })
  @Column({ type: 'enum', enum: AssessmentType })
  assessment_type: AssessmentType;

  @ApiProperty()
  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  started_at: Date;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'timestamp with time zone', nullable: true })
  completed_at: Date | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Time limit for timed advanced assessments',
  })
  @Column({ type: 'timestamp with time zone', nullable: true })
  expires_at: Date | null;

  @ApiProperty({
    default: 0,
    description: 'Number of times user switched tabs during assessment',
  })
  @Column({ type: 'integer', default: 0 })
  tab_switch_count: number;

  @ApiProperty({
    default: 0,
    description: 'Number of copy-paste attempts during assessment',
  })
  @Column({ type: 'integer', default: 0 })
  copy_paste_count: number;

  @ApiProperty({
    default: false,
    description: 'Whether assessment was auto-submitted due to violations',
  })
  @Column({ type: 'boolean', default: false })
  force_submitted: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'AI-generated questions for advanced assessment only',
  })
  @Column({ type: 'jsonb', nullable: true })
  generated_questions_json: Record<string, any> | null;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
