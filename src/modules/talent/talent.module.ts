import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { UploadModule } from '../upload/upload.module';
import { TalentProfile } from './entities/talent-profile.entity';
import { TalentController } from './talent.controller';
import { TalentService } from './talent.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TalentProfile]),
    UsersModule,
    AuthModule,
    UploadModule,
  ],
  controllers: [TalentController],
  providers: [TalentService],
})
export class TalentModule {}