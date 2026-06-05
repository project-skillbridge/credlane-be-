import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface ResourceItem {
  title: string;
  description: string;
  url: string;
  duration: string;
  type: 'article' | 'video' | 'course';
}

@Entity('ai_learning_resources')
@Index(['track', 'level'], { unique: true })
export class AiLearningResource {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'frontend' })
  @Column({ type: 'varchar', length: 50 })
  track: string;

  @ApiProperty({ example: 'mid' })
  @Column({ type: 'varchar', length: 20 })
  level: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  banner_title: string;

  @ApiProperty()
  @Column({ type: 'text' })
  banner_description: string;

  @ApiProperty()
  @Column({ type: 'jsonb' })
  resources: ResourceItem[];

  @ApiProperty()
  @Column({ type: 'jsonb' })
  videos: ResourceItem[];

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updated_at: Date;
}
