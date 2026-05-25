import { AuthService } from './auth.service';
import { SuccessMessages } from '../../shared';
import { env } from '../../config/env';

/**
 * Focused unit tests for the forgotPassword rate-limit behaviour added to
 * prevent unlimited reset requests being triggered for any account by
 * bypassing the client-side button lockout (tab-switching etc.).
 */
describe('AuthService.forgotPassword — per-account rate limiting', () => {
  let service: AuthService;

  let usersService: { findByEmail: jest.Mock };
  let passwordResetOtpService: { countRecentRequests: jest.Mock };
  let passwordResetQueue: { enqueue: jest.Mock };

  const existingUser = { id: 'user-1', email: 'alice@example.com' };

  beforeEach(() => {
    usersService = { findByEmail: jest.fn() };
    passwordResetOtpService = { countRecentRequests: jest.fn() };
    passwordResetQueue = { enqueue: jest.fn() };

    service = new AuthService(
      usersService as never,
      {} as never,
      {} as never,
      passwordResetOtpService as never,
      {} as never,
      passwordResetQueue as never,
      {} as never,
    );
  });

  it('enqueues a delivery job when the account is under the hourly limit', async () => {
    usersService.findByEmail.mockResolvedValue(existingUser);
    passwordResetOtpService.countRecentRequests.mockResolvedValue(
      env.PASSWORD_RESET_RATE_LIMIT_PER_HOUR - 1,
    );

    const result = await service.forgotPassword({ email: existingUser.email });

    expect(passwordResetQueue.enqueue).toHaveBeenCalledWith(existingUser.id);
    expect(result).toEqual({
      status: 'success',
      message: SuccessMessages.AUTH.FORGOT_PASSWORD,
    });
  });

  it('silently drops the request when the hourly limit is reached', async () => {
    usersService.findByEmail.mockResolvedValue(existingUser);
    passwordResetOtpService.countRecentRequests.mockResolvedValue(
      env.PASSWORD_RESET_RATE_LIMIT_PER_HOUR,
    );

    const result = await service.forgotPassword({ email: existingUser.email });

    expect(passwordResetQueue.enqueue).not.toHaveBeenCalled();
    // Must return the same success response to avoid leaking limit status.
    expect(result).toEqual({
      status: 'success',
      message: SuccessMessages.AUTH.FORGOT_PASSWORD,
    });
  });

  it('silently drops when the limit is exceeded (more than max requests)', async () => {
    usersService.findByEmail.mockResolvedValue(existingUser);
    passwordResetOtpService.countRecentRequests.mockResolvedValue(
      env.PASSWORD_RESET_RATE_LIMIT_PER_HOUR + 10,
    );

    await service.forgotPassword({ email: existingUser.email });

    expect(passwordResetQueue.enqueue).not.toHaveBeenCalled();
  });

  it('uses a 1-hour rolling window when querying recent requests', async () => {
    usersService.findByEmail.mockResolvedValue(existingUser);
    passwordResetOtpService.countRecentRequests.mockResolvedValue(0);

    const before = Date.now();
    await service.forgotPassword({ email: existingUser.email });
    const after = Date.now();

    const [_userId, since] = passwordResetOtpService.countRecentRequests.mock
      .calls[0] as [string, Date];

    expect(_userId).toBe(existingUser.id);
    // since should be approximately now - 1 hour
    const expectedWindowStart = before - 60 * 60 * 1000;
    expect(since.getTime()).toBeGreaterThanOrEqual(expectedWindowStart - 100);
    expect(since.getTime()).toBeLessThanOrEqual(after - 60 * 60 * 1000 + 100);
  });

  it('returns the same success response for an unknown email (no account exists)', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    const result = await service.forgotPassword({
      email: 'ghost@example.com',
    });

    expect(passwordResetQueue.enqueue).not.toHaveBeenCalled();
    expect(passwordResetOtpService.countRecentRequests).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'success',
      message: SuccessMessages.AUTH.FORGOT_PASSWORD,
    });
  });
});
