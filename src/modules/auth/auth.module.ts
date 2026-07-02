import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { StringValue } from 'ms';
import { env } from '../../config/env';
import { MailModule } from '../mail/mail.module';
import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { UsersModule } from '../users/users.module';
import { AccountSettingsController } from './account-settings.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetOtp } from './entities/password-reset-otp.entity';
import { EmailChangeOtp } from './entities/email-change-otp.entity';
import { VerificationOtp } from './entities/verification-otp.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { VerificationOtpService } from './verification-otp.service';
import { PasswordResetOtpService } from './password-reset-otp.service';
import { PasswordResetDeliveryService } from './password-reset-delivery.service';
import { PasswordResetQueueService } from './password-reset-queue.service';
import { EmailChangeOtpService } from './email-change-otp.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    TypeOrmModule.forFeature([
      VerificationOtp,
      PasswordResetOtp,
      EmailChangeOtp,
      TalentProfile,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: env.JWT_ACCESS_EXPIRES_IN as StringValue },
    }),
    UsersModule,
    MailModule,
  ],
  controllers: [AuthController, AccountSettingsController, AdminAuthController],
  providers: [
    AuthService,
    PasswordResetOtpService,
    PasswordResetDeliveryService,
    PasswordResetQueueService,
    EmailChangeOtpService,
    JwtStrategy,
    GoogleStrategy,
    VerificationOtpService,
  ],
  exports: [AuthService, PasswordResetQueueService],
})
export class AuthModule {}
