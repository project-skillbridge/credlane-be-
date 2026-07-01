import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployerProfile } from '../../employer/entities/employer-profile.entity';
import { EmployerModule } from '../../employer/employer.module';
import { EmployerRole } from '../../employer-roles/entities/employer-role.entity';
import { Offer } from '../../offers/entities/offer.entity';
import { AdminEmployersController } from './admin-employers.controller';
import { AdminEmployersService } from './admin-employers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmployerProfile, EmployerRole, Offer]),
    EmployerModule,
  ],
  controllers: [AdminEmployersController],
  providers: [AdminEmployersService],
})
export class AdminEmployersModule {}
