import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { EmployerController } from './employer.controller';
import { EmployerService } from './employer.service';
import { AuthService } from '../auth/auth.service';
import type { ChangePasswordDto } from '../auth/dto/change-password.dto';
import type { DeleteAccountDto } from '../auth/dto/delete-account.dto';
import type { RequestEmailChangeDto } from '../auth/dto/request-email-change.dto';
import type { VerifyEmailChangeDto } from '../auth/dto/verify-email-change.dto';

describe('EmployerController', () => {
  let controller: EmployerController;
  let authService: {
    changePassword: jest.Mock;
    requestEmailChange: jest.Mock;
    verifyEmailChange: jest.Mock;
    deleteAccount: jest.Mock;
  };

  const userId = 'employer-user-1';

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
    };

    const employerService = {} as EmployerService;

    const moduleRef = await Test.createTestingModule({
      controllers: [EmployerController],
      providers: [
        { provide: EmployerService, useValue: employerService },
        { provide: AuthService, useValue: authService },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(EmployerController);
  });

  it('maps the expected change-password handler', () => {
    expect(Reflect.getMetadata(PATH_METADATA, EmployerController)).toBe(
      'employer',
    );
    expect(Reflect.getMetadata(PATH_METADATA, controller.changePassword)).toBe(
      'settings/change-password',
    );
    expect(
      Reflect.getMetadata(METHOD_METADATA, controller.changePassword),
    ).toBe(RequestMethod.PATCH);
  });

  it('changes password, returns the service result, and clears cookies', async () => {
    const dto: ChangePasswordDto = {
      currentPassword: 'OldP@ssword1',
      newPassword: 'NewP@ssword2',
      confirmNewPassword: 'NewP@ssword2',
    };

    const serviceResult = { status: 'success' as const, message: 'OK' };
    authService.changePassword.mockResolvedValue(serviceResult);

    const response = buildMockResponse();

    const result = await controller.changePassword(userId, dto, response);

    expect(authService.changePassword).toHaveBeenCalledWith(userId, dto);
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
      controller.changePassword(userId, dto, response),
    ).rejects.toThrow('Current password is incorrect');
    expect(response.clearCookie).not.toHaveBeenCalled();
  });

  it('maps the expected change-email handler', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.requestEmailChange),
    ).toBe('settings/change-email');
    expect(
      Reflect.getMetadata(METHOD_METADATA, controller.requestEmailChange),
    ).toBe(RequestMethod.POST);
  });

  it('requests email change and returns the service result', async () => {
    const dto: RequestEmailChangeDto = {
      newEmail: 'new.email@company.com',
    };
    const serviceResult = {
      status: 'success' as const,
      message: 'Verification OTP sent to new email',
    };
    authService.requestEmailChange.mockResolvedValue(serviceResult);

    const result = await controller.requestEmailChange(userId, dto);

    expect(authService.requestEmailChange).toHaveBeenCalledWith(userId, dto);
    expect(result).toEqual(serviceResult);
  });

  it('maps the expected verify-email-change handler', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.verifyEmailChange),
    ).toBe('settings/change-email/verify');
    expect(
      Reflect.getMetadata(METHOD_METADATA, controller.verifyEmailChange),
    ).toBe(RequestMethod.POST);
  });

  it('verifies email change, returns the service result, and clears cookies', async () => {
    const dto: VerifyEmailChangeDto = {
      newEmail: 'new.email@company.com',
      otp: '123456',
    };
    const serviceResult = {
      status: 'success' as const,
      message: 'Work email changed. Please log in again.',
    };
    authService.verifyEmailChange.mockResolvedValue(serviceResult);

    const response = buildMockResponse();

    const result = await controller.verifyEmailChange(userId, dto, response);

    expect(authService.verifyEmailChange).toHaveBeenCalledWith(userId, dto);
    expect(response.clearCookie).toHaveBeenCalled();
    expect(result).toEqual(serviceResult);
  });

  it('does not clear cookies when email verification fails', async () => {
    const dto: VerifyEmailChangeDto = {
      newEmail: 'new.email@company.com',
      otp: '000000',
    };
    authService.verifyEmailChange.mockRejectedValue(
      new Error('Invalid or expired OTP'),
    );

    const response = buildMockResponse();

    await expect(
      controller.verifyEmailChange(userId, dto, response),
    ).rejects.toThrow('Invalid or expired OTP');
    expect(response.clearCookie).not.toHaveBeenCalled();
  });

  it('maps the expected delete-account handler', () => {
    expect(Reflect.getMetadata(PATH_METADATA, controller.deleteAccount)).toBe(
      'settings/account',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, controller.deleteAccount)).toBe(
      RequestMethod.DELETE,
    );
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

    const result = await controller.deleteAccount(
      userId,
      dto,
      request,
      response,
    );

    expect(authService.deleteAccount).toHaveBeenCalledWith(userId, dto, {
      ip_address: '127.0.0.1',
      user_agent: 'jest-agent',
    });
    expect(response.clearCookie).toHaveBeenCalled();
    expect(result).toEqual(serviceResult);
  });

  it('does not clear cookies when account deletion fails', async () => {
    const dto: DeleteAccountDto = { confirmation: 'DELETE' };
    authService.deleteAccount.mockRejectedValue(new Error('Delete failed'));
    const response = buildMockResponse();

    await expect(
      controller.deleteAccount(userId, dto, buildMockRequest(), response),
    ).rejects.toThrow('Delete failed');
    expect(response.clearCookie).not.toHaveBeenCalled();
  });
});
