import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { EmployerController } from './employer.controller';
import { EmployerService } from './employer.service';
import { EmployerVerificationService } from './employer-verification.service';
import { EmployerProfile } from './entities/employer-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmployerProfile, User]),
    UsersModule,
    AuthModule,
    NotificationsModule,
  ],
  controllers: [EmployerController],
  providers: [EmployerService, EmployerVerificationService],
  exports: [EmployerVerificationService],
})
export class EmployerModule {}
