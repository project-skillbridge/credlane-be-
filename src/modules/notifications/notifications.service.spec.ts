import { NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import {
  NotificationType,
  UserNotification,
} from './entities/user-notification.entity';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(() => {
    notificationRepo = {
      create: jest.fn((data) => Object.assign(new UserNotification(), data)),
      save: jest.fn(async (row) => row),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    service = new NotificationsService(notificationRepo as never);
  });

  it('creates a notification', async () => {
    const saved = await service.create({
      userId: 'user-1',
      type: NotificationType.ADVANCED_ASSESSMENT_SCORE_READY,
      title: 'Results ready',
      body: 'You scored 80%.',
      data: { percentage: 80 },
    });

    expect(saved.user_id).toBe('user-1');
    expect(notificationRepo.save).toHaveBeenCalled();
  });

  it('counts unread notifications', async () => {
    notificationRepo.count.mockResolvedValue(2);

    await expect(service.countUnread('user-1')).resolves.toBe(2);
    expect(notificationRepo.count).toHaveBeenCalledWith({
      where: { user_id: 'user-1', read_at: IsNull() },
    });
  });

  it('marks a notification as read', async () => {
    await service.markAsRead('user-1', 'notification-1');

    expect(notificationRepo.update).toHaveBeenCalledWith(
      { id: 'notification-1', user_id: 'user-1', read_at: IsNull() },
      { read_at: expect.any(Date) },
    );
  });

  it('throws when marking an unknown notification as read', async () => {
    notificationRepo.update.mockResolvedValue({ affected: 0 });

    await expect(
      service.markAsRead('user-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
