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
import { ApiProperty } from '@nestjs/swagger';
import { EmployerAssessment } from './employer-assessment.entity';

export enum EmployerQuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  SHORT_ANSWER = 'short_answer',
}

@Entity('employer_assessment_questions')
@Index(
  'UQ_employer_assessment_questions_assessment_position',
  ['assessment_id', 'position'],
  { unique: true },
)
export class EmployerAssessmentQuestion {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  assessment_id: string;

  @ManyToOne(() => EmployerAssessment, (assessment) => assessment.questions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assessment_id' })
  assessment: EmployerAssessment;

  @ApiProperty()
  @Column({ type: 'integer' })
  position: number;

  @ApiProperty()
  @Column({ type: 'text' })
  question_text: string;

  @ApiProperty({ enum: EmployerQuestionType })
  @Column({
    type: 'enum',
    enum: EmployerQuestionType,
    enumName: 'employer_assessment_question_type_enum',
  })
  question_type: EmployerQuestionType;

  @ApiProperty({ required: false, nullable: true, type: [String] })
  @Column({ type: 'jsonb', nullable: true })
  options: string[] | null;

  @ApiProperty()
  @Column({ type: 'text' })
  correct_answer: string;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
