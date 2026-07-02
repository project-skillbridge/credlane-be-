import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import type { StringValue } from 'ms';
import { Repository } from 'typeorm';
import { env } from '../../config/env';
import { MailService } from '../mail/mail.service';
import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { AdminTier, User, UserRole } from '../users/entities/user.entity';
import { OAUTH_DEFAULT_COUNTRY, UsersService } from '../users/users.service';
import type { AccountDeletionMetadata } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestEmailChangeDto } from './dto/request-email-change.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailChangeDto } from './dto/verify-email-change.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyPasswordResetOtpDto } from './dto/verify-password-reset-otp.dto';
import { VerificationOtpSource } from './entities/verification-otp.entity';
import { JwtPayload } from './strategies/jwt.strategy';
import { VerificationOtpService } from './verification-otp.service';
import { PasswordResetOtpService } from './password-reset-otp.service';
import { PasswordResetQueueService } from './password-reset-queue.service';
import { EmailChangeOtpService } from './email-change-otp.service';
import { GoogleProfile } from './strategies/google.strategy';
import {
  normalizeOAuthSignupRole,
  type OAuthSignupRole,
} from './oauth-signup-role';
import {
  BadRequestError,
  ErrorMessages,
  NotFoundError,
  SuccessMessages,
  UnauthorizedError,
} from '../../shared';

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  fullname: string;
  avatar_url: string | null;
  country: string;
  role: UserRole;
  admin_tier?: AdminTier | null;
  track?: string | null;
  is_verified: boolean;
  onboarding_complete: boolean;
  linkedin_url?: string | null;
  profile_verified?: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface AuthSession {
  message: string;
  data: {
    user: AuthUser;
  };
}

export interface AuthResult {
  message: string;
  data: AuthSession['data'];
  tokens: AuthTokens;
}

export interface AuthResponse {
  message: string;
  status: 'success';
  data: AuthSession['data'];
}

export interface OtpDeliveryResponse {
  message: string;
  otp_expires_at: string;
  otp_expires_in_seconds: number;
}

export type VerifyEmailResult = AuthResult;

export interface ForgotPasswordResponse {
  status: 'success';
  message: string;
}

export interface ResetPasswordResponse {
  status: 'success';
  message: string;
}

export interface VerifyPasswordResetOtpResponse {
  status: 'success';
  message: string;
}

/** Normalized profile used by OAuth callbacks (e.g. Google). */
export interface OAuthProfilePayload {
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly verificationOtpService: VerificationOtpService,
    private readonly passwordResetOtpService: PasswordResetOtpService,
    private readonly mailService: MailService,
    private readonly passwordResetQueue: PasswordResetQueueService,
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepository: Repository<TalentProfile>,
    private readonly emailChangeOtpService?: EmailChangeOtpService,
  ) {}

  async register(dto: RegisterDto): Promise<OtpDeliveryResponse> {
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      country: OAUTH_DEFAULT_COUNTRY,
      role: dto.role,
      signupReason:
        dto.role === UserRole.EMPLOYER ? dto.reasonForJoining : undefined,
    });

    const issuedOtp = await this.verificationOtpService.issue(
      user.id,
      VerificationOtpSource.INITIAL,
    );
    await this.mailService.sendVerificationOtp({
      to: user.email,
      otp: issuedOtp.code,
      expiresAt: issuedOtp.expiresAt,
      recipientFirstName: user.first_name,
    });

    return this.buildOtpDeliveryResponse(
      SuccessMessages.AUTH.VERIFICATION_OTP_SENT,
      issuedOtp.expiresAt,
    );
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<VerifyEmailResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestError(ErrorMessages.AUTH.INVALID_OR_EXPIRED_OTP);
    }

    const isValidOtp = await this.verificationOtpService.consume(
      user.id,
      dto.otp,
    );
    if (!isValidOtp) {
      throw new BadRequestError(ErrorMessages.AUTH.INVALID_OR_EXPIRED_OTP);
    }

    const verifiedUser: User = user.is_verified
      ? user
      : await this.usersService.markVerified(user.id);
    const tokens = await this.signTokens(verifiedUser);
    await this.persistRefreshToken(verifiedUser.id, tokens.refresh_token);

    return {
      message: SuccessMessages.AUTH.EMAIL_VERIFIED,
      data: { user: this.toAuthUser(verifiedUser) },
      tokens,
    };
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<OtpDeliveryResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestError(ErrorMessages.AUTH.ACCOUNT_NOT_FOUND);
    }
    if (user.is_verified) {
      throw new BadRequestError(ErrorMessages.AUTH.ACCOUNT_ALREADY_VERIFIED);
    }

    const resendCount = await this.verificationOtpService.countRecentResends(
      user.id,
      new Date(Date.now() - 60 * 60 * 1000),
    );
    if (resendCount >= env.VERIFICATION_RESEND_LIMIT_PER_HOUR) {
      throw new HttpException(
        ErrorMessages.AUTH.TOO_MANY_REQUESTS,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const issuedOtp = await this.verificationOtpService.issue(
      user.id,
      VerificationOtpSource.RESEND,
    );
    await this.mailService.sendVerificationOtp({
      to: user.email,
      otp: issuedOtp.code,
      expiresAt: issuedOtp.expiresAt,
      recipientFirstName: user.first_name,
    });

    return this.buildOtpDeliveryResponse(
      SuccessMessages.AUTH.VERIFICATION_EMAIL_RESENT,
      issuedOtp.expiresAt,
    );
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user)
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_CREDENTIALS);

    if (!user.is_verified) {
      throw new ForbiddenException({
        error: 'EMAIL_NOT_VERIFIED',
        message: ErrorMessages.AUTH.EMAIL_NOT_VERIFIED,
        email: user.email,
      });
    }

    if (!user.password) {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_CREDENTIALS);
    }
    const valid = await argon2.verify(user.password, dto.password);
    if (!valid) {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_CREDENTIALS);
    }

    return this.issueTokens(user, SuccessMessages.AUTH.LOGIN);
  }

  /**
   * Login for the Super Admin Dashboard (super_admin/admin/reviewer tiers).
   * Unlike the generic login(), this surfaces distinct error messages per
   * the dashboard spec — admin accounts are invite-only, so leaking
   * existence here is an accepted tradeoff.
   */
  async adminLogin(
    dto: LoginDto,
  ): Promise<AuthResult & { data: { user: AuthUser; redirect_path: string } }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || user.role !== UserRole.ADMIN) {
      throw new NotFoundError(ErrorMessages.AUTH.NO_ADMIN_ACCOUNT_FOUND);
    }

    if (!user.is_active) {
      throw new ForbiddenException({
        error: 'ACCOUNT_DEACTIVATED',
        message: ErrorMessages.AUTH.ACCOUNT_DEACTIVATED,
      });
    }

    if (!user.password) {
      throw new UnauthorizedError(
        ErrorMessages.AUTH.INCORRECT_EMAIL_OR_PASSWORD,
      );
    }
    const valid = await argon2.verify(user.password, dto.password);
    if (!valid) {
      throw new UnauthorizedError(
        ErrorMessages.AUTH.INCORRECT_EMAIL_OR_PASSWORD,
      );
    }

    await this.usersService.recordLastLogin(user.id);

    const result = await this.issueTokens(user, SuccessMessages.AUTH.LOGIN);
    return {
      ...result,
      data: {
        ...result.data,
        redirect_path: this.getAdminRedirectPath(user.admin_tier),
      },
    };
  }

  private getAdminRedirectPath(tier: AdminTier | null): string {
    return tier === AdminTier.REVIEWER ? '/question-bank' : '/overview';
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponse> {
    const user = await this.usersService.findByEmail(dto.email);

    if (user) {
      const windowStart = new Date(Date.now() - 60 * 60 * 1000);
      const recentRequests =
        await this.passwordResetOtpService.countRecentRequests(
          user.id,
          windowStart,
        );

      if (recentRequests < env.PASSWORD_RESET_RATE_LIMIT_PER_HOUR) {
        this.passwordResetQueue.enqueue(user.id);
      }
      // Rate-limited requests are silently dropped — the response is always
      // identical so callers cannot infer account existence or limit status.
    }

    return {
      status: 'success',
      message: SuccessMessages.AUTH.FORGOT_PASSWORD,
    };
  }

  private buildOtpDeliveryResponse(
    message: string,
    expiresAt: Date,
  ): OtpDeliveryResponse {
    return {
      message,
      otp_expires_at: expiresAt.toISOString(),
      otp_expires_in_seconds: Math.max(
        1,
        Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
      ),
    };
  }

  async verifyPasswordResetOtp(
    dto: VerifyPasswordResetOtpDto,
  ): Promise<VerifyPasswordResetOtpResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestError(ErrorMessages.AUTH.INVALID_OR_EXPIRED_OTP);
    }

    const valid = await this.passwordResetOtpService.verify(user.id, dto.otp);
    if (!valid) {
      throw new BadRequestError(ErrorMessages.AUTH.INVALID_OR_EXPIRED_OTP);
    }

    return {
      status: 'success',
      message: SuccessMessages.AUTH.PASSWORD_RESET_OTP_VERIFIED,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<ResetPasswordResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestError(ErrorMessages.AUTH.INVALID_OR_EXPIRED_OTP);
    }

    const valid = await this.passwordResetOtpService.consume(user.id, dto.otp);
    if (!valid) {
      throw new BadRequestError(ErrorMessages.AUTH.INVALID_OR_EXPIRED_OTP);
    }

    const passwordHash = await argon2.hash(dto.password);
    await this.usersService.updatePassword(user.id, passwordHash);

    return {
      status: 'success',
      message: SuccessMessages.AUTH.PASSWORD_UPDATED,
    };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ status: 'success'; message: string }> {
    const user = await this.usersService.findOne(userId);

    if (!user.password) {
      throw new BadRequestError(ErrorMessages.AUTH.OAUTH_ACCOUNT_NO_PASSWORD);
    }

    const currentValid = await argon2.verify(
      user.password,
      dto.currentPassword,
    );
    if (!currentValid) {
      throw new BadRequestError(ErrorMessages.AUTH.WRONG_CURRENT_PASSWORD);
    }

    const sameAsNew = await argon2.verify(user.password, dto.newPassword);
    if (sameAsNew) {
      throw new BadRequestError(ErrorMessages.AUTH.SAME_PASSWORD);
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.usersService.updatePassword(userId, passwordHash);

    return {
      status: 'success',
      message: SuccessMessages.AUTH.PASSWORD_CHANGED,
    };
  }

  async requestEmailChange(
    userId: string,
    dto: RequestEmailChangeDto,
  ): Promise<{ status: 'success'; message: string }> {
    const user = await this.usersService.findOne(userId);
    const existing = await this.usersService.findByEmail(dto.newEmail);
    if (existing && existing.id !== userId) {
      throw new BadRequestError(ErrorMessages.USER.EMAIL_ALREADY_REGISTERED);
    }
    if (existing?.id === userId) {
      throw new BadRequestError('New email must differ from current email');
    }

    if (!this.emailChangeOtpService) {
      throw new Error('EmailChangeOtpService is not configured');
    }

    const issuedOtp = await this.emailChangeOtpService.issue(
      userId,
      dto.newEmail,
    );
    await this.mailService.sendVerificationOtp({
      to: dto.newEmail,
      otp: issuedOtp.code,
      expiresAt: issuedOtp.expiresAt,
      recipientFirstName: user.first_name,
    });

    return {
      status: 'success',
      message: 'Verification OTP sent to new email',
    };
  }

  async verifyEmailChange(
    userId: string,
    dto: VerifyEmailChangeDto,
  ): Promise<{ status: 'success'; message: string }> {
    const user = await this.usersService.findOne(userId);
    const existing = await this.usersService.findByEmail(dto.newEmail);
    if (existing && existing.id !== userId) {
      throw new BadRequestError(ErrorMessages.USER.EMAIL_ALREADY_REGISTERED);
    }
    if (existing?.id === user.id) {
      throw new BadRequestError('New email must differ from current email');
    }

    if (!this.emailChangeOtpService) {
      throw new Error('EmailChangeOtpService is not configured');
    }

    const isValidOtp = await this.emailChangeOtpService.consume(
      userId,
      dto.newEmail,
      dto.otp,
    );
    if (!isValidOtp) {
      throw new BadRequestError(ErrorMessages.AUTH.INVALID_OR_EXPIRED_OTP);
    }

    await this.usersService.updateEmail(userId, dto.newEmail);
    return {
      status: 'success',
      message: 'Work email changed. Please log in again.',
    };
  }

  async deleteAccount(
    userId: string,
    dto: DeleteAccountDto,
    metadata: AccountDeletionMetadata = {},
  ): Promise<{ status: 'success'; message: string }> {
    if (dto.confirmation !== 'DELETE') {
      throw new BadRequestException('Type DELETE to confirm account deletion');
    }
    await this.usersService.softDeleteAccountWithAudit(userId, metadata);
    return { status: 'success', message: 'Account deleted' };
  }

  async requestDataExport(userId: string): Promise<{
    status: 'success';
    message: string;
    download_url: string;
  }> {
    const user = await this.usersService.findOne(userId);
    const talentProfile = await this.talentProfileRepository.findOne({
      where: { user_id: userId },
    });

    const exportPayload = {
      generated_at: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        country: user.country,
        role: user.role,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified,
        onboarding_complete: user.onboarding_complete,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
      },
      talent_profile: talentProfile,
    };

    const json = JSON.stringify(exportPayload, null, 2);
    const namePart = `${user.first_name ?? ''}-${user.last_name ?? ''}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = `skillbridge-data-export-${namePart}-${new Date().toISOString().slice(0, 10)}.json`;

    // Send email with the export template and JSON attachment
    await this.mailService.sendDataExportReady({
      to: user.email,
      recipientFirstName: user.first_name,
      fileName: filename,
      attachmentContent: Buffer.from(json),
    });

    // Also return a data-URI so the frontend can trigger an immediate download
    const base64 = Buffer.from(json).toString('base64');
    const downloadUrl = `data:application/json;base64,${base64}`;

    return {
      status: 'success',
      message: `Data export emailed to ${user.email}`,
      download_url: downloadUrl,
    };
  }

  async googleCallback(
    profile: GoogleProfile,
    signupRole?: OAuthSignupRole,
  ): Promise<AuthResult> {
    // Normalize GoogleProfile to OAuthProfilePayload format
    const normalizedProfile: OAuthProfilePayload = {
      providerId: profile.providerId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.picture,
    };

    return this.finalizeOAuthLogin('google', normalizedProfile, signupRole);
  }

  async verifyGoogleAuthCode(
    code: string,
    redirectUri: string = 'postmessage',
    signupRole?: string,
  ): Promise<AuthResult> {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      this.logger.error(`Google token exchange failed: ${errorText}`);
      throw new BadRequestError('Failed to exchange Google authorization code');
    }

    const tokens = (await tokenResponse.json()) as { access_token: string };

    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      },
    );

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      this.logger.error(`Google profile fetch failed: ${errorText}`);
      throw new BadRequestError('Failed to fetch Google profile');
    }

    const profileData = (await profileResponse.json()) as {
      id: string;
      email: string;
      given_name?: string;
      name?: string;
      family_name?: string;
      picture?: string;
    };

    const normalizedProfile: OAuthProfilePayload = {
      providerId: profileData.id,
      email: profileData.email,
      firstName: profileData.given_name || profileData.name || 'User',
      lastName: profileData.family_name || '',
      avatarUrl: profileData.picture || null,
    };

    let parsedRole: OAuthSignupRole | undefined;
    if (signupRole) {
      parsedRole = normalizeOAuthSignupRole(signupRole) || undefined;
    }

    return this.finalizeOAuthLogin('google', normalizedProfile, parsedRole);
  }

  async refresh(
    refreshToken: string | undefined,
  ): Promise<{ message: string; tokens: AuthTokens }> {
    if (!refreshToken) {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_REFRESH_TOKEN);
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_REFRESH_TOKEN);
    }

    const user = await this.usersService.findOneOrNull(payload.sub);
    if (!user?.refreshTokenHash) {
      throw new UnauthorizedError(ErrorMessages.AUTH.REFRESH_TOKEN_REVOKED);
    }

    const matches = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!matches) {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_REFRESH_TOKEN);
    }

    const tokens = await this.signTokens(user);
    const nextHash = await argon2.hash(tokens.refresh_token);
    const rotated = await this.usersService.rotateRefreshTokenHash(
      user.id,
      user.refreshTokenHash,
      nextHash,
    );
    if (!rotated) {
      throw new UnauthorizedError(ErrorMessages.AUTH.INVALID_REFRESH_TOKEN);
    }

    return {
      message: SuccessMessages.AUTH.TOKEN_REFRESHED,
      tokens,
    };
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  async logoutByRefreshToken(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: env.JWT_REFRESH_SECRET,
      });
    } catch {
      return;
    }

    const user = await this.usersService.findOneOrNull(payload.sub);
    if (!user?.refreshTokenHash) return;

    const matches = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!matches) return;

    await this.usersService.setRefreshTokenHash(user.id, null);
  }

  async getProfile(userId: string): Promise<AuthUser> {
    const user = await this.usersService.findOne(userId);
    const profile =
      user.role === UserRole.TALENT
        ? await this.talentProfileRepository.findOne({
            where: { user_id: userId },
            select: { track: true, linkedin_url: true, profile_verified: true },
          })
        : null;

    return {
      ...this.toAuthUser(user),
      track: profile?.track ?? null,
      linkedin_url: profile?.linkedin_url ?? null,
      profile_verified: profile?.profile_verified ?? false,
    };
  }

  async issueSessionForUser(
    userId: string,
    message: string,
  ): Promise<AuthResult> {
    const user = await this.usersService.findOne(userId);
    return this.issueTokens(user, message);
  }

  toResponse(session: AuthSession): AuthResponse {
    return {
      message: session.message,
      status: 'success',
      data: session.data,
    };
  }

  /**
   * Returns OAuth row, auto-link by email, or new user.
   */
  async finalizeOAuthLogin(
    provider: string,
    profile: OAuthProfilePayload,
    signupRole?: OAuthSignupRole,
  ): Promise<AuthResult> {
    const user = await this.usersService.resolveOAuthUserFromProviderProfile(
      provider,
      profile,
      signupRole,
    );
    return this.issueTokens(user, SuccessMessages.AUTH.LOGIN);
  }

  getFrontendOrigin(): string {
    return env.FRONTEND_URL;
  }

  buildFrontendRedirectUrl(user: AuthUser): string {
    return `${this.getFrontendOrigin()}${this.getPostLoginRedirectPath(user)}`;
  }

  /** Post-login redirect based on the user's persisted role. */
  private getPostLoginRedirectPath(user: AuthUser): string {
    if (!user.onboarding_complete) {
      switch (user.role) {
        case UserRole.TALENT:
          return '/talent/onboarding';
        case UserRole.EMPLOYER:
          return '/employer/onboarding';
        default:
          return '/dashboard';
      }
    }

    switch (user.role) {
      case UserRole.TALENT:
        return '/t/dashboard';
      case UserRole.EMPLOYER:
        return '/e/dashboard';
      case UserRole.ADMIN:
        return '/admin';
      default:
        return '/t/dashboard';
    }
  }

  private async issueTokens(user: User, message: string): Promise<AuthResult> {
    const tokens = await this.signTokens(user);
    await this.persistRefreshToken(user.id, tokens.refresh_token);

    return {
      message,
      data: {
        user: this.toAuthUser(user),
      },
      tokens,
    };
  }

  private async signTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      admin_tier: user.admin_tier,
      onboarding_complete: user.onboarding_complete,
    };
    const accessTokenExpiresIn =
      user.role === UserRole.ADMIN
        ? env.ADMIN_JWT_ACCESS_EXPIRES_IN
        : env.JWT_ACCESS_EXPIRES_IN;
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: env.JWT_ACCESS_SECRET,
          expiresIn: accessTokenExpiresIn as StringValue,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: env.JWT_REFRESH_SECRET,
          expiresIn: env.JWT_REFRESH_EXPIRES_IN as StringValue,
        },
      ),
    ]);
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private async persistRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hash = await argon2.hash(refreshToken);
    await this.usersService.setRefreshTokenHash(userId, hash);
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      fullname: user.fullname,
      avatar_url: user.avatar_url,
      country: user.country,
      role: user.role,
      admin_tier: user.admin_tier,
      is_verified: user.is_verified,
      onboarding_complete: user.onboarding_complete,
    };
  }
}
