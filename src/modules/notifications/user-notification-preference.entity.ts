import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationType } from './notification-type.enum';

export enum NotificationPreferenceChannel {
  EMAIL = 'email',
  IN_APP = 'in_app',
}

@Entity('user_notification_preferences')
@Index(
  'UQ_user_notification_preferences_user_channel_type',
  ['user_id', 'channel', 'type'],
  { unique: true },
)
export class UserNotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 20 })
  channel: NotificationPreferenceChannel;

  @Column({ type: 'varchar', length: 64 })
  type: NotificationType;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
