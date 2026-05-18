import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { UploadModule } from '../upload/upload.module';
import { TalentProfile } from './entities/talent-profile.entity';
import { PersonalAssessmentController } from './assessment/personal-assessment.controller';
import { PersonalAssessmentService } from './assessment/personal-assessment.service';
import { TalentController } from './talent.controller';
import { TalentService } from './talent.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TalentProfile]),
    UsersModule,
    AuthModule,
    UploadModule,
  ],
  controllers: [TalentController, PersonalAssessmentController],
  providers: [TalentService, PersonalAssessmentService],
})
export class TalentModule {}