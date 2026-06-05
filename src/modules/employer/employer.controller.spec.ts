import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { EmployerController } from './employer.controller';
import { EmployerService } from './employer.service';
import { AuthService } from '../auth/auth.service';
import type { ChangePasswordDto } from '../auth/dto/change-password.dto';

describe('EmployerController', () => {
  let controller: EmployerController;
  let authService: { changePassword: jest.Mock };

  const userId = 'employer-user-1';

  const buildMockResponse = (): Response => {
    return {
      clearCookie: jest.fn(),
    } as never;
  };

  beforeEach(async () => {
    authService = {
      changePassword: jest.fn(),
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
    expect(Reflect.getMetadata(METHOD_METADATA, controller.changePassword)).toBe(
      RequestMethod.PATCH,
    );
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

    await expect(controller.changePassword(userId, dto, response)).rejects.toThrow(
      'Current password is incorrect',
    );
    expect(response.clearCookie).not.toHaveBeenCalled();
  });
});

