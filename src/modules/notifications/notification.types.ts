import { NotificationType } from './notification-type.enum';

/** DB row shape used by NotificationsService (decoupled from TypeORM entity for strict typing). */
export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: Date | null;
  created_at: Date;
};

export type NewNotificationPayload = {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: null;
};

/** API list item shape (mirrors NotificationItemDto without class-validator/swagger coupling). */
export type NotificationListItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};
