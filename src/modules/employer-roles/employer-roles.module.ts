import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EmployerAssessment,
  EmployerAssessmentInvite,
  EmployerAssessmentSubmission,
} from '../employer-assessments/entities';
import { Offer } from '../offers/entities/offer.entity';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import { TalentRoleInterest } from '../talent/entities/talent-role-interest.entity';
import { EmployerRole } from './entities/employer-role.entity';
import { EmployerRolesService } from './employer-roles.service';
import { EmployerRolesController } from './employer-roles.controller';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmployerRole,
      EmployerAssessment,
      EmployerAssessmentInvite,
      EmployerAssessmentSubmission,
      EmployerPoolProfile,
      TalentRoleInterest,
      Offer,
    ]),
    UploadModule,
  ],
  controllers: [EmployerRolesController],
  providers: [EmployerRolesService],
  exports: [EmployerRolesService],
})
export class EmployerRolesModule {}
