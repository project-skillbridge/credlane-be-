import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmployerModule } from '../employer/employer.module';
import { EmployerContactRequest } from './entities/employer-contact-request.entity';
import { EmployerSavedCandidate } from './entities/employer-saved-candidate.entity';
import { EmployerDiscoveryController } from './employer-discovery.controller';
import { EmployerDiscoveryService } from './employer-discovery.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmployerPoolProfile,
      EmployerSavedCandidate,
      EmployerContactRequest,
      User,
    ]),
    NotificationsModule,
    EmployerModule,
  ],
  controllers: [EmployerDiscoveryController],
  providers: [EmployerDiscoveryService],
  exports: [EmployerDiscoveryService],
})
export class EmployerDiscoveryModule {}
