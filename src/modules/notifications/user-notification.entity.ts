import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NotificationType } from './notification-type.enum';

@Entity('user_notifications')
@Index('IDX_user_notifications_user_created', ['user_id', 'created_at'])
@Index('IDX_user_notifications_user_unread', ['user_id', 'read_at'])
export class UserNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 64 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  read_at: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
