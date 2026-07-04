import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { TalentProfile } from '../../talent/entities/talent-profile.entity';
import { EmployerProfile } from '../../employer/entities/employer-profile.entity';
import { Offer } from '../../offers/entities/offer.entity';
import { AssessmentResult } from '../../assessments/entities/assessment-result.entity';
import { AiUsageLog } from '../../ai/ai-usage-log.entity';
import { AdminOverviewController } from './admin-overview.controller';
import { AdminOverviewService } from './admin-overview.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      TalentProfile,
      EmployerProfile,
      Offer,
      AssessmentResult,
      AiUsageLog,
    ]),
  ],
  controllers: [AdminOverviewController],
  providers: [AdminOverviewService],
})
export class AdminOverviewModule {}
