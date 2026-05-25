import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployerProfile } from '../employer/entities/employer-profile.entity';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { UsersModule } from '../users/users.module';
import { EmployerJobReadyDigestService } from './employer-job-ready-digest.service';
import { UserNotification } from './user-notification.entity';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserNotification,
      TalentProfile,
      EmployerProfile,
      EmployerPoolProfile,
    ]),
    UsersModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDispatchService,
    EmployerJobReadyDigestService,
  ],
  exports: [NotificationsService, NotificationDispatchService],
})
export class NotificationsModule {}
