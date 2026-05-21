import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
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

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(UserNotification)
    private readonly notificationRepo: Repository<UserNotification>,
  ) {}

  async hasDedupedNotification(
    userId: string,
    type: NotificationType,
    eligibilityDate: string,
  ): Promise<boolean> {
    const count = await this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId })
      .andWhere('notification.type = :type', { type })
      .andWhere("notification.data->>'eligibilityDate' = :eligibilityDate", {
        eligibilityDate,
      })
      .getCount();

    return count > 0;
  }

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

    const items: NotificationListItem[] = [];
    for (const row of rows) {
      items.push(this.toDto(this.asRow(row)));
    }
    return items;
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
      data: row.data,
      isRead: row.read_at != null,
      readAt: row.read_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    };
  }
}
