import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentQuestion } from '../assessments/entities/assessment-question.entity';
import { EmployerSavedCandidate } from '../employer-discovery/entities/employer-saved-candidate.entity';
import { EmployerRole } from '../employer-roles/entities/employer-role.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Offer } from '../offers/entities/offer.entity';
import { User } from '../users/entities/user.entity';
import {
  EmployerAssessment,
  EmployerAssessmentInvite,
  EmployerAssessmentQuestion,
  EmployerAssessmentSubmission,
} from './entities';
import { EmployerAssessmentsController } from './employer-assessments.controller';
import { EmployerAssessmentsService } from './employer-assessments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmployerAssessment,
      EmployerAssessmentQuestion,
      EmployerAssessmentInvite,
      EmployerAssessmentSubmission,
      AssessmentQuestion,
      EmployerSavedCandidate,
      User,
      EmployerRole,
      Offer,
    ]),
    NotificationsModule,
  ],
  controllers: [EmployerAssessmentsController],
  providers: [EmployerAssessmentsService],
  exports: [EmployerAssessmentsService],
})
export class EmployerAssessmentsModule {}
