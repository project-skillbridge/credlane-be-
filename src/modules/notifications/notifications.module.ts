import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserNotification]), UsersModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationDispatchService],
  exports: [NotificationsService, NotificationDispatchService],
})
export class NotificationsModule {}
