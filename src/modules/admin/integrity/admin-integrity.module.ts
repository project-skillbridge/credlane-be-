import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentAttempt } from '../../assessments/entities/assessment-attempt.entity';
import { AssessmentScore } from '../../assessments/entities/assessment-score.entity';
import { AdminIntegrityController } from './admin-integrity.controller';
import { AdminIntegrityService } from './admin-integrity.service';

@Module({
  imports: [TypeOrmModule.forFeature([AssessmentAttempt, AssessmentScore])],
  controllers: [AdminIntegrityController],
  providers: [AdminIntegrityService],
})
export class AdminIntegrityModule {}
