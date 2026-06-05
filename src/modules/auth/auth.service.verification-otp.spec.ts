import { AuthService } from './auth.service';
import { SuccessMessages } from '../../shared';
import { UserRole } from '../users/entities/user.entity';
import { VerificationOtpSource } from './entities/verification-otp.entity';

describe('AuthService verification OTP delivery metadata', () => {
  let service: AuthService;

  let usersService: {
    create: jest.Mock;
    findByEmail: jest.Mock;
  };
  let verificationOtpService: {
    issue: jest.Mock;
    countRecentResends: jest.Mock;
  };
  let mailService: { sendVerificationOtp: jest.Mock };

  const issuedExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

  beforeEach(() => {
    usersService = {
      create: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'employer@example.com',
        first_name: 'Ada',
      }),
      findByEmail: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'employer@example.com',
        first_name: 'Ada',
        is_verified: false,
      }),
    };

    verificationOtpService = {
      issue: jest.fn().mockResolvedValue({
        code: '123456',
        expiresAt: issuedExpiresAt,
      }),
      countRecentResends: jest.fn().mockResolvedValue(0),
    };

    mailService = {
      sendVerificationOtp: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      usersService as never,
      {} as never,
      verificationOtpService as never,
      {} as never,
      mailService as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('returns OTP expiry metadata on register', async () => {
    const result = await service.register({
      email: 'employer@example.com',
      password: 'Secret123!',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: UserRole.EMPLOYER,
      reasonForJoining: 'hire faster',
    });

    expect(usersService.create).toHaveBeenCalled();
    expect(verificationOtpService.issue).toHaveBeenCalledWith(
      'user-1',
      VerificationOtpSource.INITIAL,
    );
    expect(result.message).toBe(SuccessMessages.AUTH.VERIFICATION_OTP_SENT);
    expect(result.otp_expires_at).toBe(issuedExpiresAt.toISOString());
    expect(result.otp_expires_in_seconds).toBeGreaterThan(0);
  });

  it('returns OTP expiry metadata on resend verification', async () => {
    const result = await service.resendVerification({
      email: 'employer@example.com',
    });

    expect(verificationOtpService.issue).toHaveBeenCalledWith(
      'user-1',
      VerificationOtpSource.RESEND,
    );
    expect(result.message).toBe(SuccessMessages.AUTH.VERIFICATION_EMAIL_RESENT);
    expect(result.otp_expires_at).toBe(issuedExpiresAt.toISOString());
    expect(result.otp_expires_in_seconds).toBeGreaterThan(0);
  });
});
