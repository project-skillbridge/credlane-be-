import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentQuestion } from '../../assessments/entities/assessment-question.entity';
import { QuestionImportService } from '../../../database/import/question-import.service';
import { AdminQuestionsController } from './admin-questions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AssessmentQuestion])],
  controllers: [AdminQuestionsController],
  providers: [QuestionImportService],
  exports: [QuestionImportService],
})
export class AdminQuestionsModule {}
