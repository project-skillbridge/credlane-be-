import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { MailModule } from '../../mail/mail.module';
import { AdminEmailChangeAudit } from '../../users/entities/admin-email-change-audit.entity';
import { User } from '../../users/entities/user.entity';
import { UsersModule } from '../../users/users.module';
import { AdminAdminsController } from './admin-admins.controller';
import { AdminAdminsService } from './admin-admins.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AdminEmailChangeAudit]),
    UsersModule,
    AuthModule,
    MailModule,
  ],
  controllers: [AdminAdminsController],
  providers: [AdminAdminsService],
})
export class AdminAdminsModule {}
