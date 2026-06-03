import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentQuestion } from '../../assessments/entities/assessment-question.entity';
import { QuestionImportService } from '../../../database/import/question-import.service';
import { TalentModule } from '../../talent/talent.module';
import { AdminPersonalAssessmentQuestionsController } from './admin-personal-assessment-questions.controller';
import { AdminQuestionsController } from './admin-questions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AssessmentQuestion]), TalentModule],
  controllers: [
    AdminQuestionsController,
    AdminPersonalAssessmentQuestionsController,
  ],
  providers: [QuestionImportService],
  exports: [QuestionImportService],
})
export class AdminQuestionsModule {}
