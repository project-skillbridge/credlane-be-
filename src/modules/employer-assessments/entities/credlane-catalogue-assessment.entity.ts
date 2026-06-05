import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployerAssessmentExperienceLevel } from './employer-assessment.entity';

@Entity('credlane_catalogue_assessments')
@Index('IDX_credlane_catalogue_assessments_active', ['is_active'])
@Index('IDX_credlane_catalogue_assessments_track_level', [
  'role_track',
  'experience_level',
])
export class CredlaneCatalogueAssessment {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ example: '30 minutes' })
  @Column({ type: 'varchar', length: 100 })
  estimated_completion_time: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 100 })
  role_track: string;

  @ApiProperty({ enum: EmployerAssessmentExperienceLevel })
  @Column({
    type: 'enum',
    enum: EmployerAssessmentExperienceLevel,
    enumName: 'employer_assessment_experience_level_enum',
  })
  experience_level: EmployerAssessmentExperienceLevel;

  @ApiProperty()
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
