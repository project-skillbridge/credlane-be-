import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum NotificationType {
  ADVANCED_ASSESSMENT_SCORE_READY = 'advanced_assessment_score_ready',
}

@Entity('user_notifications')
export class UserNotification {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Index('IDX_user_notifications_user_created')
  @Index('IDX_user_notifications_user_unread')
  @Column({ type: 'uuid' })
  user_id: string;

  @ApiProperty({ enum: NotificationType })
  @Column({ type: 'varchar', length: 64 })
  type: NotificationType;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @ApiProperty()
  @Column({ type: 'text' })
  body: string;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'timestamp with time zone', nullable: true })
  read_at: Date | null;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
