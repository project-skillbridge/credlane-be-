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
import { EmployerAssessment } from './employer-assessment.entity';

@Entity('employer_assessment_external_invites')
@Index('IDX_external_invites_assessment', ['assessment_id'])
@Index('UQ_external_invites_assessment_email', ['assessment_id', 'email'], {
  unique: true,
})
export class EmployerAssessmentExternalInvite {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  assessment_id: string;

  @ManyToOne(() => EmployerAssessment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_id' })
  assessment: EmployerAssessment;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  sent_at: Date;
}
