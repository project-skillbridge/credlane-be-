import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TalentProfile } from '../../talent/entities/talent-profile.entity';
import { AssessmentAttempt } from '../../assessments/entities/assessment-attempt.entity';
import { AssessmentResult } from '../../assessments/entities/assessment-result.entity';
import { AssessmentScore } from '../../assessments/entities/assessment-score.entity';
import { AdminTalentsController } from './admin-talents.controller';
import { AdminTalentsService } from './admin-talents.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TalentProfile,
      AssessmentAttempt,
      AssessmentResult,
      AssessmentScore,
    ]),
  ],
  controllers: [AdminTalentsController],
  providers: [AdminTalentsService],
})
export class AdminTalentsModule {}
