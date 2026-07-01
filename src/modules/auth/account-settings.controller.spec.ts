import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SuccessMessages } from '../../shared';
import { AccountSettingsController } from './account-settings.controller';
import { AuthService } from './auth.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { DeleteAccountDto } from './dto/delete-account.dto';
import type { RequestEmailChangeDto } from './dto/request-email-change.dto';
import type { VerifyEmailChangeDto } from './dto/verify-email-change.dto';

describe('AccountSettingsController', () => {
  let controller: AccountSettingsController;
  let authService: {
    changePassword: jest.Mock;
    requestEmailChange: jest.Mock;
    verifyEmailChange: jest.Mock;
    deleteAccount: jest.Mock;
    requestDataExport: jest.Mock;
  };

  const user: AuthenticatedUser = {
    sub: 'user-abc',
    email: 'talent@example.com',
    role: 'TALENT' as never,
    admin_tier: null,
    onboarding_complete: true,
  };

  const buildMockResponse = (): Response => {
    return {
      clearCookie: jest.fn(),
    } as never;
  };

  const buildMockRequest = (): Request => {
    return {
      ip: '127.0.0.1',
      get: jest.fn((header: string) =>
        header.toLowerCase() === 'user-agent' ? 'jest-agent' : undefined,
      ),
    } as never;
  };

  beforeEach(async () => {
    authService = {
      changePassword: jest.fn(),
      requestEmailChange: jest.fn(),
      verifyEmailChange: jest.fn(),
      deleteAccount: jest.fn(),
      requestDataExport: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AccountSettingsController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(AccountSettingsController);
  });

  it('uses the auth route prefix and does not expose deactivate', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AccountSettingsController)).toBe(
      'auth',
    );
    expect(
      (controller as unknown as { deactivateAccount?: unknown })
        .deactivateAccount,
    ).toBeUndefined();
  });

  it('maps the expected account settings handlers', () => {
    expect(Reflect.getMetadata(PATH_METADATA, controller.changePassword)).toBe(
      'change-password',
    );
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.requestEmailChange),
    ).toBe('change-email/request');
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.verifyEmailChange),
    ).toBe('change-email/verify');
    expect(Reflect.getMetadata(PATH_METADATA, controller.deleteAccount)).toBe(
      'account',
    );
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.requestDataExport),
    ).toBe('account/data-export');
    expect(Reflect.getMetadata(METHOD_METADATA, controller.deleteAccount)).toBe(
      RequestMethod.DELETE,
    );
  });

  it('changes password, returns the service result, and clears cookies', async () => {
    const dto: ChangePasswordDto = {
      currentPassword: 'OldP@ssword1',
      newPassword: 'NewP@ssword2',
      confirmNewPassword: 'NewP@ssword2',
    };
    const serviceResult = {
      status: 'success' as const,
      message: SuccessMessages.AUTH.PASSWORD_CHANGED,
    };
    authService.changePassword.mockResolvedValue(serviceResult);
    const response = buildMockResponse();

    const result = await controller.changePassword(user, dto, response);

    expect(authService.changePassword).toHaveBeenCalledWith(user.sub, dto);
    expect(response.clearCookie).toHaveBeenCalled();
    expect(result).toEqual(serviceResult);
  });

  it('does not clear cookies when password change fails', async () => {
    const dto: ChangePasswordDto = {
      currentPassword: 'wrong',
      newPassword: 'NewP@ssword2',
      confirmNewPassword: 'NewP@ssword2',
    };
    authService.changePassword.mockRejectedValue(
      new Error('Current password is incorrect'),
    );
    const response = buildMockResponse();

    await expect(
      controller.changePassword(user, dto, response),
    ).rejects.toThrow('Current password is incorrect');
    expect(response.clearCookie).not.toHaveBeenCalled();
  });

  it('requests an email change OTP without clearing cookies', () => {
    const dto: RequestEmailChangeDto = {
      newEmail: 'new.email@example.com',
    };
    const serviceResult = {
      status: 'success' as const,
      message: 'Verification OTP sent to new email',
    };
    authService.requestEmailChange.mockReturnValue(serviceResult);

    const result = controller.requestEmailChange(user, dto);

    expect(authService.requestEmailChange).toHaveBeenCalledWith(user.sub, dto);
    expect(result).toEqual(serviceResult);
  });

  it('verifies email change and clears cookies', async () => {
    const dto: VerifyEmailChangeDto = {
      newEmail: 'new.email@example.com',
      otp: '123456',
    };
    const serviceResult = {
      status: 'success' as const,
      message: 'Work email changed. Please log in again.',
    };
    authService.verifyEmailChange.mockResolvedValue(serviceResult);
    const response = buildMockResponse();

    const result = await controller.verifyEmailChange(user, dto, response);

    expect(authService.verifyEmailChange).toHaveBeenCalledWith(user.sub, dto);
    expect(response.clearCookie).toHaveBeenCalled();
    expect(result).toEqual(serviceResult);
  });

  it('does not clear cookies when email verification fails', async () => {
    const dto: VerifyEmailChangeDto = {
      newEmail: 'new.email@example.com',
      otp: '000000',
    };
    authService.verifyEmailChange.mockRejectedValue(
      new Error('Invalid or expired otp'),
    );
    const response = buildMockResponse();

    await expect(
      controller.verifyEmailChange(user, dto, response),
    ).rejects.toThrow('Invalid or expired otp');
    expect(response.clearCookie).not.toHaveBeenCalled();
  });

  it('deletes the account with request metadata and clears cookies', async () => {
    const dto: DeleteAccountDto = { confirmation: 'DELETE' };
    const serviceResult = {
      status: 'success' as const,
      message: 'Account deleted',
    };
    authService.deleteAccount.mockResolvedValue(serviceResult);
    const request = buildMockRequest();
    const response = buildMockResponse();

    const result = await controller.deleteAccount(user, dto, request, response);

    expect(authService.deleteAccount).toHaveBeenCalledWith(user.sub, dto, {
      ip_address: '127.0.0.1',
      user_agent: 'jest-agent',
    });
    expect(response.clearCookie).toHaveBeenCalled();
    expect(result).toEqual(serviceResult);
  });

  it('does not clear cookies when delete fails', async () => {
    const dto: DeleteAccountDto = { confirmation: 'DELETE' };
    authService.deleteAccount.mockRejectedValue(new Error('Delete failed'));
    const response = buildMockResponse();

    await expect(
      controller.deleteAccount(user, dto, buildMockRequest(), response),
    ).rejects.toThrow('Delete failed');
    expect(response.clearCookie).not.toHaveBeenCalled();
  });

  it('returns account data export', () => {
    const serviceResult = {
      status: 'success' as const,
      message: 'Data export generated',
      data_export: { user: { id: user.sub } },
    };
    authService.requestDataExport.mockReturnValue(serviceResult);

    const result = controller.requestDataExport(user);

    expect(authService.requestDataExport).toHaveBeenCalledWith(user.sub);
    expect(result).toEqual(serviceResult);
  });
});
