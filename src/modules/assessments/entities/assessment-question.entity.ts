import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AssessmentType {
  PERSONAL = 'personal',
  SKILL = 'skill',
  ADVANCED = 'advanced',
}

export enum QuestionType {
  SINGLE_PICK = 'single_pick',
  MULTI_PICK = 'multi_pick',
  REQUIRED_TEXT = 'required_text',
  OPTIONAL_TEXT = 'optional_text',
}

export enum SkillLevel {
  ENTRY = 'entry',
  JUNIOR = 'junior',
  MID = 'mid',
  SENIOR = 'senior',
  EXPERT = 'expert',
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

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Section number for personal assessment (1-7)',
  })
  @Column({ type: 'integer', nullable: true })
  section: number | null;

  @ApiProperty()
  @Column({ type: 'integer' })
  question_number: number;

  @ApiProperty({ default: true })
  @Column({ type: 'boolean', default: true })
  is_required: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Minimum character count for text responses',
  })
  @Column({ type: 'integer', nullable: true })
  min_char_count: number | null;

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
    description: 'Correct answer for skill assessment questions only',
  })
  @Column({ type: 'text', nullable: true })
  correct_answer: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Track for skill assessment questions only',
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  track: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: SkillLevel,
    description: 'Level for skill assessment questions only',
  })
  @Column({ type: 'enum', enum: SkillLevel, nullable: true })
  level: SkillLevel | null;

  @ApiProperty({
    default: false,
    description: 'Whether this question triggers an inline follow-up field',
  })
  @Column({ type: 'boolean', default: false })
  has_follow_up: boolean;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
