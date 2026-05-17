import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AssessmentType {
  SKILL = 'skill',
  ADVANCED = 'advanced',
}

export enum QuestionType {
  SINGLE_PICK = 'single_pick',
  MULTI_PICK = 'multi_pick',
  REQUIRED_TEXT = 'required_text',
  OPTIONAL_TEXT = 'optional_text',
}

export enum VerifiedLevel {
  ENTRY = 'entry',
  JUNIOR = 'junior',
  MID = 'mid',
  SENIOR = 'senior',
  EXPERT = 'expert',
}

export enum SlotType {
  SITUATIONAL = 'situational',
  WORK_TASK = 'work_task',
  REFLECTION = 'reflection',
}

@Entity('assessment_questions')
export class AssessmentQuestion {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ enum: AssessmentType })
  @Column({ type: 'enum', enum: AssessmentType })
  assessment_type: AssessmentType;

  @ApiProperty({ enum: QuestionType })
  @Column({ type: 'enum', enum: QuestionType })
  question_type: QuestionType;

  @ApiProperty()
  @Column({ type: 'text' })
  question_text: string;

  @ApiProperty()
  @Column({ type: 'integer' })
  question_number: number;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Array of options for pick-type questions',
  })
  @Column({ type: 'jsonb', nullable: true })
  options: string[] | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Correct answer for skill assessment questions',
  })
  @Column({ type: 'text', nullable: true })
  correct_answer: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Track for skill assessment questions (e.g., frontend_developer)',
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  track: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: VerifiedLevel,
    description: 'Target verified level for this question',
  })
  @Column({ type: 'enum', enum: VerifiedLevel, nullable: true })
  verified_level: VerifiedLevel | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Specific competency being tested (e.g., react-hooks, async-programming)',
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  competency: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: SlotType,
    description: 'Question categorization for advanced assessments',
  })
  @Column({ type: 'enum', enum: SlotType, nullable: true })
  slot_type: SlotType | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Additional flexible data (difficulty, tags, author, etc.)',
  })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @ApiProperty({
    default: false,
    description: 'Whether question is active/published or draft',
  })
  @Column({ type: 'boolean', default: false })
  is_live: boolean;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
