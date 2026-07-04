import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentAttempt } from '../../assessments/entities/assessment-attempt.entity';
import { AdminEngagementController } from './admin-engagement.controller';
import { AdminEngagementService } from './admin-engagement.service';

@Module({
  imports: [TypeOrmModule.forFeature([AssessmentAttempt])],
  controllers: [AdminEngagementController],
  providers: [AdminEngagementService],
  exports: [AdminEngagementService],
})
export class AdminEngagementModule {}
