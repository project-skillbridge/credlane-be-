import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiReportController } from './ai-report.controller';
import { AiReportService } from './ai-report.service';
import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { AssessmentAttempt, AssessmentResult } from '../assessments/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([TalentProfile, AssessmentAttempt, AssessmentResult]),
  ],
  controllers: [AiReportController],
  providers: [AiReportService],
})
export class AiReportModule {}
