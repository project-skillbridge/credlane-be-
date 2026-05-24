import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { EmployerPoolProfile } from '../../talent/entities/employer-pool-profile.entity';

@Entity('employer_saved_candidates')
@Unique('UQ_employer_saved_candidate', [
  'employer_user_id',
  'candidate_user_id',
])
@Index('IDX_employer_saved_candidates_employer', ['employer_user_id'])
@Index('IDX_employer_saved_candidates_candidate', ['candidate_user_id'])
export class EmployerSavedCandidate {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  employer_user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employer_user_id' })
  employer: User;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  candidate_user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_user_id' })
  candidate: User;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Column({ type: 'uuid', nullable: true })
  employer_pool_profile_id: string | null;

  @ManyToOne(() => EmployerPoolProfile, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'employer_pool_profile_id' })
  employer_pool_profile: EmployerPoolProfile | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
