import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { EmployerAssessment } from '../../employer-assessments/entities/employer-assessment.entity';

export enum EmployerRoleStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
}

@Entity('employer_roles')
@Index('IDX_employer_roles_employer', ['employer_user_id'])
@Index('IDX_employer_roles_status', ['status'])
export class EmployerRole {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  employer_user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employer_user_id' })
  employer: User;

  @ApiProperty({ example: 'Senior Backend Engineer' })
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @ApiProperty({ example: 'Engineering' })
  @Column({ type: 'varchar', length: 255 })
  category: string;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiPropertyOptional({ example: 'Full-time' })
  @Column({ type: 'varchar', length: 50, nullable: true })
  employment_type: string | null;

  @ApiPropertyOptional({ example: 'Remote' })
  @Column({ type: 'varchar', length: 50, nullable: true })
  work_arrangement: string | null;

  @ApiPropertyOptional({ example: 'Bachelor' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  education: string | null;

  @ApiPropertyOptional({ type: [String] })
  @Column({ type: 'text', array: true, nullable: true })
  keywords: string[] | null;

  @ApiPropertyOptional({ example: 80000 })
  @Column({ type: 'integer', nullable: true })
  salary_min: number | null;

  @ApiPropertyOptional({ example: 120000 })
  @Column({ type: 'integer', nullable: true })
  salary_max: number | null;

  @ApiPropertyOptional({ example: 'USD' })
  @Column({ type: 'varchar', length: 10, nullable: true })
  currency: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @Column({ type: 'uuid', nullable: true })
  assessment_id: string | null;

  @ManyToOne(() => EmployerAssessment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assessment_id' })
  assessment: EmployerAssessment | null;

  @ApiProperty({ enum: EmployerRoleStatus, default: EmployerRoleStatus.ACTIVE })
  @Column({
    type: 'enum',
    enum: EmployerRoleStatus,
    enumName: 'employer_role_status_enum',
    default: EmployerRoleStatus.ACTIVE,
  })
  status: EmployerRoleStatus;

  @ApiProperty({ default: 0 })
  @Column({ type: 'integer', default: 0 })
  offers_sent_count: number;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
