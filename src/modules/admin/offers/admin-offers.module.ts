import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Offer } from '../../offers/entities/offer.entity';
import { User } from '../../users/entities/user.entity';
import { EmployerProfile } from '../../employer/entities/employer-profile.entity';
import { AdminOffersController } from './admin-offers.controller';
import { AdminOffersService } from './admin-offers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Offer, User, EmployerProfile])],
  controllers: [AdminOffersController],
  providers: [AdminOffersService],
})
export class AdminOffersModule {}
