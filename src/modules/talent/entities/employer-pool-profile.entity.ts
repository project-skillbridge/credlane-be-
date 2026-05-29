import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TalentProfile } from './talent-profile.entity';

@Entity('employer_pool_profiles')
export class EmployerPoolProfile {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid', unique: true })
  talent_profile_id: string;

  @OneToOne(() => TalentProfile)
  @JoinColumn({ name: 'talent_profile_id' })
  talent_profile: TalentProfile;

  @ApiProperty({ format: 'uuid', description: 'user.id of the talent' })
  @Column({ type: 'uuid' })
  candidate_id: string;

  @ApiProperty()
  @Column({ type: 'timestamp with time zone' })
  verified_at: Date;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  track: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  specialization: string | null;

  @ApiProperty()
  @Column({ type: 'varchar', length: 20 })
  verified_level: string;

  @ApiProperty({ description: 'Weighted assessment score out of 100' })
  @Column({ type: 'integer' })
  score: number;

  @ApiProperty({ description: 'not_ready | emerging | job_ready' })
  @Column({ type: 'varchar', length: 20 })
  tier: string;

  @ApiProperty({ required: false, nullable: true, type: [String] })
  @Column({ type: 'jsonb', nullable: true })
  strong_competencies: string[] | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  competency_scores: Record<string, number> | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  industry_background: Record<string, unknown> | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  work_preferences: Record<string, unknown> | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  availability: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  job_search_status: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @ApiProperty({ default: true })
  @Column({ type: 'boolean', default: true })
  integrity_clean: boolean;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', length: 500, nullable: true })
  profile_url: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  shareable_link_token: string | null;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
