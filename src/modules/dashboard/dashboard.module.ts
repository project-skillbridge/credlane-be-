import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentAttempt, AssessmentResult } from '../assessments/entities';
import { EmployerAssessment } from '../employer-assessments/entities/employer-assessment.entity';
import { EmployerAssessmentSubmission } from '../employer-assessments/entities/employer-assessment-submission.entity';
import { EmployerSavedCandidate } from '../employer-discovery/entities/employer-saved-candidate.entity';
import { EmployerProfile } from '../employer/entities/employer-profile.entity';
import { EmployerRole } from '../employer-roles/entities/employer-role.entity';
import { Offer } from '../offers/entities/offer.entity';
import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TalentProfile,
      AssessmentResult,
      AssessmentAttempt,
      EmployerProfile,
      EmployerRole,
      EmployerSavedCandidate,
      EmployerAssessment,
      EmployerAssessmentSubmission,
      Offer,
      EmployerPoolProfile,
    ]),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
