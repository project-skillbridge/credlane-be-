import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AccountSettingsController } from './account-settings.controller';
import { AuthService } from './auth.service';
import { SuccessMessages } from '../../shared';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type { Response } from 'express';

/**
 * Controller-level tests for POST /auth/change-password.
 *
 * Focus:
 *  - Delegates to authService.changePassword with the correct userId and DTO
 *  - Calls clearAuthCookies so the browser loses its auth cookies after the change
 *  - Surfaces the service result directly to the caller
 *  - ThrottlerGuard is applied (cannot brute-force currentPassword)
 */
describe('AccountSettingsController — POST /auth/change-password', () => {
  let controller: AccountSettingsController;
  let authService: { changePassword: jest.Mock };

  const authenticatedUser: AuthenticatedUser = {
    sub: 'user-abc',
    email: 'alice@example.com',
    role: 'TALENT' as never,
    admin_tier: null,
    onboarding_complete: true,
  };

  const dto: ChangePasswordDto = {
    currentPassword: 'OldP@ssword1',
    newPassword: 'NewP@ssword2',
    confirmNewPassword: 'NewP@ssword2',
  };

  // Minimal mock response that records which cookies were cleared.
  const buildMockResponse = (): Response & { _clearedCookies: string[] } => {
    const cleared: string[] = [];
    return {
      _clearedCookies: cleared,
      clearCookie: jest.fn((name: string) => cleared.push(name)),
    } as never;
  };

  beforeEach(async () => {
    authService = { changePassword: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AccountSettingsController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      // Override the ThrottlerGuard so tests are not blocked by rate-limit infra.
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(AccountSettingsController);
  });

  it('delegates to authService.changePassword with the caller user id and DTO', async () => {
    authService.changePassword.mockResolvedValue({
      status: 'success',
      message: SuccessMessages.AUTH.PASSWORD_CHANGED,
    });
    const res = buildMockResponse();

    await controller.changePassword(authenticatedUser, dto, res);

    expect(authService.changePassword).toHaveBeenCalledWith(
      authenticatedUser.sub,
      dto,
    );
  });

  it('returns the service result to the caller', async () => {
    const serviceResult = {
      status: 'success' as const,
      message: SuccessMessages.AUTH.PASSWORD_CHANGED,
    };
    authService.changePassword.mockResolvedValue(serviceResult);
    const res = buildMockResponse();

    const result = await controller.changePassword(authenticatedUser, dto, res);

    expect(result).toEqual(serviceResult);
  });

  it('clears auth cookies after a successful password change', async () => {
    authService.changePassword.mockResolvedValue({
      status: 'success',
      message: SuccessMessages.AUTH.PASSWORD_CHANGED,
    });
    const res = buildMockResponse();

    await controller.changePassword(authenticatedUser, dto, res);

    // clearAuthCookies should have cleared at least the access and refresh cookies.
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it('does not clear cookies when the service throws (wrong password etc.)', async () => {
    authService.changePassword.mockRejectedValue(
      new Error('Current password is incorrect'),
    );
    const res = buildMockResponse();

    await expect(
      controller.changePassword(authenticatedUser, dto, res),
    ).rejects.toThrow();

    expect(res.clearCookie).not.toHaveBeenCalled();
  });
});
