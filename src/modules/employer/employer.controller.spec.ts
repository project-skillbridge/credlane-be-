import { NotFoundException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { EmployerController } from './employer.controller';
import { EmployerService } from './employer.service';
import { EmployerVerificationService } from './employer-verification.service';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification-type.enum';
import type { ChangePasswordDto } from '../auth/dto/change-password.dto';
import type { DeleteAccountDto } from '../auth/dto/delete-account.dto';
import type { RequestEmailChangeDto } from '../auth/dto/request-email-change.dto';
import type { VerifyEmailChangeDto } from '../auth/dto/verify-email-change.dto';

describe('EmployerController', () => {
  let controller: EmployerController;
  let notificationsService: {
    listForUser: jest.Mock;
    markAsRead: jest.Mock;
    markAllAsRead: jest.Mock;
    countUnread: jest.Mock;
  };
  let verificationService: {
    getVerificationStatusDetail: jest.Mock;
  };
  let employerService: {
    getPublicProfile: jest.Mock;
  };
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

    notificationsService = {
      listForUser: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      countUnread: jest.fn(),
    };
    verificationService = {
      getVerificationStatusDetail: jest.fn(),
    };
    employerService = {
      getPublicProfile: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [EmployerController],
      providers: [
        { provide: EmployerService, useValue: employerService },
        { provide: AuthService, useValue: authService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: EmployerVerificationService, useValue: verificationService },
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

  it('maps the expected list-notifications handler', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.listNotifications),
    ).toBe('notifications');
    expect(
      Reflect.getMetadata(METHOD_METADATA, controller.listNotifications),
    ).toBe(RequestMethod.GET);
  });

  it('lists notifications via the notifications service', async () => {
    notificationsService.listForUser.mockResolvedValue([
      {
        id: 'notif-1',
        type: NotificationType.OFFER_ACCEPTED,
        title: 'Offer accepted',
        body: 'Jane accepted your offer',
        data: { offerId: 'offer-1' },
        is_read: false,
        read_at: null,
        created_at: '2026-06-01T10:00:00.000Z',
      },
    ]);

    const result = await controller.listNotifications(userId, { limit: 20 });

    expect(notificationsService.listForUser).toHaveBeenCalledWith(userId, 20);
    expect(result).toEqual({
      items: [
        {
          notification_id: 'notif-1',
          type: 'offer_accepted_assessment_unlocked',
          message: 'Jane accepted your offer',
          timestamp: '2026-06-01T10:00:00.000Z',
          read: false,
          link: { entity_id: 'offer-1', entity_type: 'offer' },
          data: { offer_id: 'offer-1' },
        },
      ],
    });
  });

  it('maps the expected mark-all-notifications-read handler', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.markAllNotificationsAsRead),
    ).toBe('notifications/read-all');
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        controller.markAllNotificationsAsRead,
      ),
    ).toBe(RequestMethod.PATCH);
  });

  it('marks all notifications as read via the notifications service', async () => {
    notificationsService.markAllAsRead.mockResolvedValue(undefined);

    await controller.markAllNotificationsAsRead(userId);

    expect(notificationsService.markAllAsRead).toHaveBeenCalledWith(userId);
  });

  it('maps the expected mark-notification-read handler', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.markNotificationAsRead),
    ).toBe('notifications/:notification_id/read');
    expect(
      Reflect.getMetadata(METHOD_METADATA, controller.markNotificationAsRead),
    ).toBe(RequestMethod.PATCH);
  });

  it('marks a notification as read via the notifications service', async () => {
    notificationsService.markAsRead.mockResolvedValue(undefined);

    await controller.markNotificationAsRead(userId, 'notif-1');

    expect(notificationsService.markAsRead).toHaveBeenCalledWith(
      userId,
      'notif-1',
    );
  });

  it('propagates not-found when the notification does not belong to the employer', async () => {
    notificationsService.markAsRead.mockRejectedValue(
      new NotFoundException('Notification not found'),
    );

    await expect(
      controller.markNotificationAsRead(userId, 'missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('maps the expected unread-count handler', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.getUnreadNotificationCount),
    ).toBe('notifications/unread-count');
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        controller.getUnreadNotificationCount,
      ),
    ).toBe(RequestMethod.GET);
  });

  it('returns unread notification count via the notifications service', async () => {
    notificationsService.countUnread.mockResolvedValue(4);

    const result = await controller.getUnreadNotificationCount(userId);

    expect(notificationsService.countUnread).toHaveBeenCalledWith(userId);
    expect(result).toEqual({ unread_count: 4 });
  });

  it('maps the expected verification-status handler', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.getVerificationStatus),
    ).toBe('verification-status');
    expect(
      Reflect.getMetadata(METHOD_METADATA, controller.getVerificationStatus),
    ).toBe(RequestMethod.GET);
  });

  it('returns structured verification status', async () => {
    verificationService.getVerificationStatusDetail.mockResolvedValue({
      verified: false,
      criteria: {
        email_verified: true,
        website_resolvable: false,
        linkedin_provided: true,
      },
      banner_visible: true,
    });

    const result = await controller.getVerificationStatus(userId);

    expect(
      verificationService.getVerificationStatusDetail,
    ).toHaveBeenCalledWith(userId);
    expect(result.banner_visible).toBe(true);
  });

  it('maps the expected public profile handler', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, controller.getPublicProfile),
    ).toBe('profile/public/:employer_id');
    expect(
      Reflect.getMetadata(METHOD_METADATA, controller.getPublicProfile),
    ).toBe(RequestMethod.GET);
  });

  it('returns a public employer profile by id', async () => {
    employerService.getPublicProfile.mockResolvedValue({
      company_name: 'Acme Labs',
      is_verified: true,
    });

    const result = await controller.getPublicProfile(
      '22222222-2222-4222-8222-222222222222',
    );

    expect(employerService.getPublicProfile).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
    );
    expect(result.company_name).toBe('Acme Labs');
  });
});
