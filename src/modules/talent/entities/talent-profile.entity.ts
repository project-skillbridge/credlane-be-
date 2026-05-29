import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { VerifiedLevel } from '../../assessments/entities/assessment-question.entity';

export enum TalentProfileStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  NOT_READY = 'not_ready',
  EMERGING = 'emerging',
  JOB_READY = 'job_ready',
}

export enum TalentAvailabilityStatus {
  ACTIVELY_LOOKING = 'actively_looking',
  OPEN_TO_OPPORTUNITIES = 'open_to_opportunities',
  NOT_LOOKING = 'not_looking',
}

@Entity('talent_profiles')
export class TalentProfile {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  user_id: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ example: 'frontend', required: false, nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  role_track: string | null;

  @ApiProperty({
    example: ['frontend_developer', 'backend_developer'],
    required: false,
    nullable: true,
    type: [String],
  })
  @Column({ type: 'text', array: true, nullable: true })
  role_tracks: string[] | null;

  @ApiProperty({
    example: 'land_first_role',
    required: false,
    nullable: true,
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  goal: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  region: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  education_level: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  linkedin_url: string | null;

  @ApiProperty({
    example: 'frontend_developer',
    required: false,
    nullable: true,
    description: 'Single selected track (step 2)',
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  track: string | null;

  @ApiProperty({
    default: false,
    description:
      'True when all profile fields including optional ones are complete',
  })
  @Column({ type: 'boolean', default: false })
  profile_verified: boolean;

  @ApiProperty({
    example: VerifiedLevel.MID,
    required: false,
    nullable: true,
    enum: VerifiedLevel,
    description:
      'Self-reported skill level collected during personal assessment; same enum as validated_level',
  })
  @Column({
    type: 'enum',
    enum: VerifiedLevel,
    enumName: 'verified_level_enum',
    nullable: true,
  })
  claimed_level: VerifiedLevel | null;

  @ApiProperty({ default: 0 })
  @Column({ type: 'integer', default: 0 })
  onboarding_step: number;

  @ApiProperty({ enum: TalentProfileStatus })
  @Column({
    type: 'enum',
    enum: TalentProfileStatus,
    default: TalentProfileStatus.NOT_STARTED,
  })
  status: TalentProfileStatus;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', length: 500, nullable: true })
  personal_website: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', length: 500, nullable: true })
  resume_url: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  resume_filename: string | null;

  @ApiProperty({
    enum: TalentAvailabilityStatus,
    default: TalentAvailabilityStatus.OPEN_TO_OPPORTUNITIES,
  })
  @Column({
    type: 'varchar',
    length: 50,
    default: TalentAvailabilityStatus.OPEN_TO_OPPORTUNITIES,
  })
  availability_status: TalentAvailabilityStatus;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  profile_share_link: string | null;

  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false })
  is_published: boolean;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'timestamp with time zone', nullable: true })
  published_at: Date | null;

  @ApiHideProperty()
  @Column({ type: 'jsonb', nullable: true })
  personal_assessment_answers: Record<string, any> | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'When personal assessment was completed',
  })
  @Column({ type: 'timestamp with time zone', nullable: true })
  personal_assessment_completed_at: Date | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'When skill assessment was completed',
  })
  @Column({ type: 'timestamp with time zone', nullable: true })
  skill_assessment_completed_at: Date | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'When advanced assessment was completed',
  })
  @Column({ type: 'timestamp with time zone', nullable: true })
  advanced_assessment_completed_at: Date | null;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: VerifiedLevel,
    description: 'Validated skill level from skill assessment',
  })
  @Column({
    type: 'enum',
    enum: VerifiedLevel,
    enumName: 'verified_level_enum',
    nullable: true,
  })
  validated_level: VerifiedLevel | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'When the current advanced assessment retake gate started',
  })
  @Column({ type: 'timestamp with time zone', nullable: true })
  assessment_locked_from: Date | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Date until which advanced assessment retakes are locked',
  })
  @Column({ type: 'timestamp with time zone', nullable: true })
  assessment_locked_until: Date | null;

  @ApiProperty({
    default: false,
    description:
      'Whether assessment_locked_until currently represents an advanced assessment retake gate',
  })
  @Column({ type: 'boolean', default: false })
  advanced_retake_required: boolean;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updated_at: Date;
}
