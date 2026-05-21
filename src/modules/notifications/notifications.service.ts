import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  NotificationType,
  UserNotification,
} from './entities/user-notification.entity';
import type { NotificationItemDto } from './dto/notification.dto';

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

  async create(input: CreateNotificationInput): Promise<UserNotification> {
    const notification = this.notificationRepo.create({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? null,
      read_at: null,
    });

    return this.notificationRepo.save(notification);
  }

  async listForUser(
    userId: string,
    limit = 20,
  ): Promise<NotificationItemDto[]> {
    const rows = await this.notificationRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
    });

    return rows.map((row) => this.toDto(row));
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

  private toDto(row: UserNotification): NotificationItemDto {
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
