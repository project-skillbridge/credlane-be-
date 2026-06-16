import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { keysToSnake } from '../../common/utils/case-transform';
import type {
  NewNotificationPayload,
  NotificationListItem,
  NotificationRow,
} from './notification.types';
import { NotificationType } from './notification-type.enum';
import { UserNotification } from './user-notification.entity';

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export function isNotificationDuplicateError(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) {
    return false;
  }
  const code =
    (err as QueryFailedError & { code?: string }).code ??
    (err.driverError as { code?: string } | undefined)?.code;
  return code === '23505';
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(UserNotification)
    private readonly notificationRepo: Repository<UserNotification>,
  ) {}

  async create(input: CreateNotificationInput): Promise<NotificationRow> {
    const payload: NewNotificationPayload = {
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? null,
      read_at: null,
    };

    const saved = await this.notificationRepo.save(payload);
    return this.asRow(saved);
  }

  async listForUser(
    userId: string,
    limit = 20,
  ): Promise<NotificationListItem[]> {
    const rows: UserNotification[] = await this.notificationRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
    });

    return rows.map((row) => this.toDto(this.asRow(row)));
  }

  async countUnread(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { user_id: userId, read_at: IsNull() },
    });
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const result = await this.notificationRepo.update(
      { id: notificationId, user_id: userId, read_at: IsNull() },
      { read_at: new Date() },
    );

    if (!result.affected) {
      throw new NotFoundException('Notification not found');
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.update(
      { user_id: userId, read_at: IsNull() },
      { read_at: new Date() },
    );
  }

  private asRow(entity: UserNotification): NotificationRow {
    return {
      id: entity.id,
      user_id: entity.user_id,
      type: entity.type,
      title: entity.title,
      body: entity.body,
      data: entity.data,
      read_at: entity.read_at,
      created_at: entity.created_at,
    };
  }

  private toDto(row: NotificationRow): NotificationListItem {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: keysToSnake(row.data),
      is_read: row.read_at != null,
      read_at: row.read_at?.toISOString() ?? null,
      created_at: row.created_at.toISOString(),
    };
  }
}
