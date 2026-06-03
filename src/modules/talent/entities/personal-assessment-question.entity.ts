import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PersonalAssessmentQuestionOption = {
  value: string;
  label: string;
};

@Entity('personal_assessment_questions')
export class PersonalAssessmentQuestionEntity {
  @ApiProperty({ example: 'PA-GEN-INT-001' })
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string;

  @ApiProperty({ example: 'international_and_remote_experience' })
  @Index()
  @Column({ type: 'varchar', length: 100 })
  section: string;

  @ApiProperty({ example: 'all' })
  @Index()
  @Column({ type: 'varchar', length: 100, default: 'all' })
  track: string;

  @ApiProperty()
  @Column({ type: 'text' })
  question: string;

  @ApiProperty({ example: 'cross_border_team_experience' })
  @Column({ type: 'varchar', length: 100, unique: true })
  field_name: string;

  @ApiProperty({ example: 'single_select' })
  @Column({ type: 'varchar', length: 30 })
  format: string;

  @ApiProperty({ default: true })
  @Column({ type: 'boolean', default: true })
  required: boolean;

  @ApiProperty({
    nullable: true,
    type: 'array',
    items: {
      type: 'object',
      properties: { value: { type: 'string' }, label: { type: 'string' } },
    },
  })
  @Column({ type: 'jsonb', nullable: true })
  options: PersonalAssessmentQuestionOption[] | null;

  @ApiProperty({ default: 0 })
  @Column({ type: 'integer', default: 0 })
  display_order: number;

  @ApiProperty({ default: true })
  @Column({ type: 'boolean', default: true })
  is_live: boolean;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
