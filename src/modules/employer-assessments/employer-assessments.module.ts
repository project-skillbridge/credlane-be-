import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentQuestion } from '../assessments/entities/assessment-question.entity';
import { EmployerSavedCandidate } from '../employer-discovery/entities/employer-saved-candidate.entity';
import { NotificationsModule } from '../notifications/notifications.module';
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
    ]),
    NotificationsModule,
  ],
  controllers: [EmployerAssessmentsController],
  providers: [EmployerAssessmentsService],
  exports: [EmployerAssessmentsService],
})
export class EmployerAssessmentsModule {}
