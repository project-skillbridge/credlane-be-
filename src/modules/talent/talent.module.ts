import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { UploadModule } from '../upload/upload.module';
import { TalentProfile } from './entities/talent-profile.entity';
import { EmployerPoolProfile } from './entities/employer-pool-profile.entity';
import {
  AssessmentAttempt,
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentResult,
  AssessmentScore,
  TalentQuestionHistory,
} from '../assessments/entities';
import { PersonalAssessmentController } from './assessment/personal-assessment.controller';
import { PersonalAssessmentService } from './assessment/personal-assessment.service';
import { AdvancedAssessmentAiService } from './assessment/advanced-assessment-ai.service';
import { AdvancedAssessmentController } from './assessment/advanced-assessment.controller';
import { AdvancedAssessmentService } from './assessment/advanced-assessment.service';
import { EmployerPoolProfileService } from './assessment/employer-pool-profile.service';
import { SkillAssessmentController } from './assessment/skill-assessment.controller';
import { SkillAssessmentService } from './assessment/skill-assessment.service';
import { TalentController } from './talent.controller';
import { TalentService } from './talent.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TalentProfile,
      EmployerPoolProfile,
      AssessmentQuestion,
      AssessmentAttempt,
      AssessmentResponse,
      AssessmentResult,
      AssessmentScore,
      TalentQuestionHistory,
    ]),
    UsersModule,
    AuthModule,
    UploadModule,
  ],
  controllers: [
    TalentController,
    PersonalAssessmentController,
    SkillAssessmentController,
    AdvancedAssessmentController,
  ],
  providers: [
    TalentService,
    PersonalAssessmentService,
    SkillAssessmentService,
    AdvancedAssessmentAiService,
    AdvancedAssessmentService,
    EmployerPoolProfileService,
  ],
})
export class TalentModule {}
