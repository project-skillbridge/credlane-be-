import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AssessmentQuestion } from './assessment-question.entity';

@Entity('question_quality_notes')
export class QuestionQualityNote {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  question_id: string;

  @ManyToOne(() => AssessmentQuestion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: AssessmentQuestion;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Column({ type: 'uuid', nullable: true })
  author_id: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_id' })
  author: User | null;

  @ApiProperty()
  @Column({ type: 'text' })
  note: string;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
