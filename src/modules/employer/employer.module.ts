import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { EmployerController } from './employer.controller';
import { EmployerPublicController } from './employer-public.controller';
import { EmployerService } from './employer.service';
import { EmployerVerificationService } from './employer-verification.service';
import { EmployerProfile } from './entities/employer-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmployerProfile, User]),
    UsersModule,
    AuthModule,
  ],
  controllers: [EmployerController, EmployerPublicController],
  providers: [EmployerService, EmployerVerificationService],
  exports: [EmployerVerificationService],
})
export class EmployerModule {}
