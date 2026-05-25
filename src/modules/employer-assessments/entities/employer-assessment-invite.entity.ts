import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { EmployerAssessment } from './employer-assessment.entity';

export enum EmployerAssessmentDeliveryMode {
  LINK = 'link',
  DIRECT = 'direct',
}

@Entity('employer_assessment_invites')
@Index('IDX_employer_assessment_invites_assessment', ['assessment_id'])
@Index('IDX_employer_assessment_invites_candidate', ['candidate_user_id'])
@Index(
  'UQ_employer_assessment_invites_assessment_candidate',
  ['assessment_id', 'candidate_user_id'],
  { unique: true },
)
export class EmployerAssessmentInvite {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  assessment_id: string;

  @ManyToOne(() => EmployerAssessment, (assessment) => assessment.invites, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assessment_id' })
  assessment: EmployerAssessment;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  candidate_user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_user_id' })
  candidate: User;

  @ApiProperty({ enum: EmployerAssessmentDeliveryMode })
  @Column({
    type: 'enum',
    enum: EmployerAssessmentDeliveryMode,
    enumName: 'employer_assessment_delivery_mode_enum',
  })
  delivery_mode: EmployerAssessmentDeliveryMode;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  sent_at: Date;
}
