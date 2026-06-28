import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentQuestion } from '../../assessments/entities/assessment-question.entity';
import { QuestionImportService } from '../../../database/import/question-import.service';
import { TalentModule } from '../../talent/talent.module';
import { AdminPersonalAssessmentQuestionsController } from './admin-personal-assessment-questions.controller';
import { AdminQuestionsController } from './admin-questions.controller';
import { AdminQuestionsBankController } from './admin-questions-bank.controller';
import { AdminQuestionsBankService } from './admin-questions-bank.service';

@Module({
  imports: [TypeOrmModule.forFeature([AssessmentQuestion]), TalentModule],
  controllers: [
    AdminQuestionsController,
    AdminPersonalAssessmentQuestionsController,
    AdminQuestionsBankController,
  ],
  providers: [QuestionImportService, AdminQuestionsBankService],
  exports: [QuestionImportService],
})
export class AdminQuestionsModule {}
