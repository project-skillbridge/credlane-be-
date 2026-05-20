import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import {
  AssessmentAttempt,
  AssessmentResponse,
  AssessmentResult,
} from '../assessments/entities';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { VerifiedProfileController } from './verified-profile.controller';
import { VerifiedProfileService } from './verified-profile.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TalentProfile,
      EmployerPoolProfile,
      AssessmentResult,
      AssessmentAttempt,
      AssessmentResponse,
    ]),
    UsersModule,
  ],
  controllers: [VerifiedProfileController],
  providers: [VerifiedProfileService],
  exports: [VerifiedProfileService],
})
export class VerifiedProfileModule {}
