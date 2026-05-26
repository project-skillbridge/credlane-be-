import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import { User } from '../users/entities/user.entity';
import { EmployerProfile } from '../employer/entities/employer-profile.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmployerModule } from '../employer/employer.module';
import { Offer } from './entities/offer.entity';
import { OfferDistributionLog } from './entities/offer-distribution-log.entity';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Offer,
      OfferDistributionLog,
      EmployerPoolProfile,
      EmployerProfile,
      User,
    ]),
    NotificationsModule,
    EmployerModule,
  ],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
