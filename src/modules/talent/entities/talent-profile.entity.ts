import { ApiProperty } from '@nestjs/swagger';
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

export enum TalentProfileStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  NOT_READY = 'not_ready',
  EMERGING = 'emerging',
  JOB_READY = 'job_ready',
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

  @ApiProperty({ default: false, description: 'True when all profile fields including optional ones are complete' })
  @Column({ type: 'boolean', default: false })
  profile_verified: boolean;

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
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  profile_share_link: string | null;

  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false })
  is_published: boolean;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'timestamp with time zone', nullable: true })
  published_at: Date | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updated_at: Date;
}