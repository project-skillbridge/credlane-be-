import { NotFoundException } from '@nestjs/common';
import { EmployerService } from './employer.service';
import { EmployerProfile } from './entities/employer-profile.entity';
import {
  buildEmployerNotificationLink,
  mapEmployerNotificationType,
  toEmployerNotificationItem,
} from './employer-notification.mapper';
import { NotificationType } from '../notifications/notification-type.enum';
import { NotFoundError } from '../../shared';
import { ProfileFieldLockedError } from './employer-profile-cooldown';

describe('EmployerService', () => {
  const userId = 'employer-user-1';

  let manager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let employerProfileRepository: {
    findOne: jest.Mock;
    manager: { transaction: jest.Mock; save: jest.Mock };
  };
  let authService: { issueSessionForUser: jest.Mock };
  let usersService: {
    getUserForOnboarding: jest.Mock;
    markOnboardingCompleteWithManager: jest.Mock;
  };
  let service: EmployerService;
  let verificationService: { checkAndUpdateVerification: jest.Mock };

  beforeEach(() => {
    manager = {
      findOne: jest.fn(),
      create: jest.fn((_entity, payload) => ({ ...payload })),
      save: jest.fn((_entity, payload) => Promise.resolve(payload)),
    };
    employerProfileRepository = {
      findOne: jest.fn(),
      manager: {
        transaction: jest.fn((callback) => callback(manager)),
        save: jest.fn((_entity, payload) => Promise.resolve(payload)),
      },
    };
    authService = {
      issueSessionForUser: jest.fn().mockResolvedValue({
        message: 'completed',
        data: { user: { id: userId } },
        tokens: { accessToken: 'access', refreshToken: 'refresh' },
      }),
    };
    usersService = {
      getUserForOnboarding: jest
        .fn()
        .mockResolvedValue({ id: userId, onboarding_complete: false }),
      markOnboardingCompleteWithManager: jest.fn().mockResolvedValue(undefined),
    };
    verificationService = {
      checkAndUpdateVerification: jest.fn().mockResolvedValue(true),
    };
    service = new EmployerService(
      employerProfileRepository as never,
      authService as never,
      usersService as never,
      verificationService as never,
    );
  });

  it('saves the doc-aligned employer profile fields', async () => {
    const existing = Object.assign(new EmployerProfile(), { user_id: userId });
    manager.findOne.mockResolvedValue(existing);

    await service.saveProfile(userId, {
      employerType: 'Recruiter',
      companyName: '  Acme Labs  ',
      companySize: '11-50',
      companyWebsite: ' https://acme.example ',
      industry: ' Fintech ',
      region: ' Nigeria ',
      linkedinCompanyPageUrl: ' https://www.linkedin.com/company/acme ',
      hiringRoles: ['frontend_developer', 'backend_developer'],
      preferredExperienceLevels: ['junior', 'mid'],
      hiringCount: '6_10',
    });

    expect(manager.save).toHaveBeenCalledWith(
      EmployerProfile,
      expect.objectContaining({
        employer_type: 'Recruiter',
        company_name: 'Acme Labs',
        company_size: '11-50',
        company_website: 'https://acme.example',
        website_url: 'https://acme.example',
        industry: 'Fintech',
        region: 'Nigeria',
        hiring_region: 'Nigeria',
        linkedin_company_page_url: 'https://www.linkedin.com/company/acme',
        hiring_roles: ['frontend_developer', 'backend_developer'],
        hiring_locations: ['Nigeria'],
        desired_roles: ['frontend_developer', 'backend_developer'],
        preferred_experience_levels: ['junior', 'mid'],
        hiring_count_range: '6_10',
      }),
    );
    expect(usersService.markOnboardingCompleteWithManager).toHaveBeenCalledWith(
      manager,
      userId,
    );
    expect(verificationService.checkAndUpdateVerification).toHaveBeenCalledWith(
      userId,
    );
  });

  it('preserves existing LinkedIn fields when profile update value is blank', async () => {
    const existing = Object.assign(new EmployerProfile(), {
      user_id: userId,
      linkedin_company_page_url: 'https://linkedin.com/company/current',
      linkedin_company_url: 'https://linkedin.com/company/current',
    });
    manager.findOne.mockResolvedValue(existing);

    await service.saveProfile(userId, {
      employerType: 'Recruiter',
      companyName: 'Acme Labs',
      companySize: '11-50',
      companyWebsite: 'https://acme.example',
      industry: 'Fintech',
      region: 'Nigeria',
      linkedinCompanyPageUrl: '   ',
      hiringRoles: ['frontend_developer'],
      preferredExperienceLevels: ['junior'],
    });

    expect(manager.save).toHaveBeenCalledWith(
      EmployerProfile,
      expect.objectContaining({
        linkedin_company_page_url: 'https://linkedin.com/company/current',
        linkedin_company_url: 'https://linkedin.com/company/current',
      }),
    );
  });

  it('completes onboarding with only required fields', async () => {
    manager.findOne.mockResolvedValue(null);

    const result = await service.completeOnboarding(userId, {
      joiningAs: 'recruiter',
      desiredRoles: ['frontend_developer'],
      region: 'Africa',
      companyWebsite: 'https://acmelabs.example',
    });

    expect(manager.create).toHaveBeenCalledWith(
      EmployerProfile,
      expect.objectContaining({
        employer_type: 'recruiter',
        joining_as: 'recruiter',
        company_name: null,
        company_size: null,
        industry: null,
        desired_roles: ['frontend_developer'],
        hiring_locations: ['Africa'],
        region: 'Africa',
        hiring_count_range: null,
        company_website: 'https://acmelabs.example',
        website_url: 'https://acmelabs.example',
        preferred_experience_levels: null,
      }),
    );
    expect(result.profile).toMatchObject({
      desired_roles: ['frontend_developer'],
      company_website: 'https://acmelabs.example',
    });
  });

  it('maps expanded legacy onboarding fields onto the employer profile', async () => {
    manager.findOne.mockResolvedValue(null);

    const result = await service.completeOnboarding(userId, {
      joiningAs: 'recruiter',
      companyName: 'Acme Labs',
      companySize: '51-200',
      industry: 'Healthtech',
      desiredRoles: ['product_manager'],
      preferredExperienceLevels: ['senior'],
      region: 'Kenya',
      hiringCountRange: '1_5',
      companyWebsite: 'https://acme.example',
      linkedinCompanyPageUrl: 'https://www.linkedin.com/company/acme',
    });

    expect(manager.create).toHaveBeenCalledWith(
      EmployerProfile,
      expect.objectContaining({
        employer_type: 'recruiter',
        joining_as: 'recruiter',
        company_name: 'Acme Labs',
        company_size: '51-200',
        industry: 'Healthtech',
        desired_roles: ['product_manager'],
        hiring_roles: ['product_manager'],
        hiring_locations: ['Kenya'],
        preferred_experience_levels: ['senior'],
        region: 'Kenya',
        hiring_region: 'Kenya',
        hiring_count_range: '1_5',
        company_website: 'https://acme.example',
        website_url: 'https://acme.example',
        linkedin_company_page_url: 'https://www.linkedin.com/company/acme',
      }),
    );
    expect(result.profile).toMatchObject({
      company_name: 'Acme Labs',
      preferred_experience_levels: ['senior'],
    });
  });

  it('converts a missing onboarding user into a forbidden onboarding error', async () => {
    usersService.getUserForOnboarding.mockRejectedValue(
      new NotFoundException(),
    );

    await expect(
      service.saveProfile(userId, {
        employerType: 'Founder',
        companyName: 'Acme Labs',
        companySize: '1-10',
        companyWebsite: 'https://acme.example',
        industry: 'Fintech',
        region: 'Nigeria',
        hiringRoles: ['frontend_developer'],
        preferredExperienceLevels: ['junior'],
      }),
    ).rejects.toThrow('Invalid user');
  });

  it('returns restricted field metadata from getProfile', async () => {
    const recentChange = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    employerProfileRepository.findOne.mockResolvedValue(
      Object.assign(new EmployerProfile(), {
        user_id: userId,
        company_name: 'Acme Labs',
        company_name_changed_at: recentChange,
      }),
    );

    const result = await service.getProfile(userId);

    expect(result.restricted_fields.company_name.locked).toBe(true);
    expect(result.restricted_fields.company_name.last_changed_at).toBe(
      recentChange.toISOString(),
    );
    expect(result.restricted_fields.company_website.locked).toBe(false);
  });

  it('blocks restricted field changes within the 180-day cooldown', async () => {
    const recentChange = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    employerProfileRepository.findOne.mockResolvedValue(
      Object.assign(new EmployerProfile(), {
        user_id: userId,
        company_name: 'Acme Labs',
        company_name_changed_at: recentChange,
      }),
    );

    await expect(
      service.updateProfile(userId, { companyName: 'New Corp' }),
    ).rejects.toThrow(ProfileFieldLockedError);
  });

  it('allows non-restricted field changes while a restricted field is locked', async () => {
    const recentChange = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    employerProfileRepository.findOne.mockResolvedValue(
      Object.assign(new EmployerProfile(), {
        user_id: userId,
        company_name: 'Acme Labs',
        company_name_changed_at: recentChange,
        industry: 'Fintech',
      }),
    );

    const result = await service.updateProfile(userId, {
      industry: 'Healthtech',
    });

    expect(result.profile.industry).toBe('Healthtech');
    expect(result.profile.company_name).toBe('Acme Labs');
  });

  it('sets changed_at when a restricted field is updated after cooldown', async () => {
    const oldChange = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    const existing = Object.assign(new EmployerProfile(), {
      user_id: userId,
      company_name: 'Acme Labs',
      company_name_changed_at: oldChange,
    });
    employerProfileRepository.findOne.mockResolvedValue(existing);

    const result = await service.updateProfile(userId, {
      companyName: 'New Corp',
    });

    expect(result.profile.company_name).toBe('New Corp');
    expect(result.profile.company_name_changed_at).toBeInstanceOf(Date);
    expect(result.profile.company_name_changed_at!.getTime()).toBeGreaterThan(
      oldChange.getTime(),
    );
  });

  it('does not overwrite profile settings with whitespace-only strings', async () => {
    const existing = Object.assign(new EmployerProfile(), {
      user_id: userId,
      company_name: 'Acme Labs',
      company_website: 'https://acme.example',
      website_url: 'https://acme.example',
      industry: 'Fintech',
      region: 'Nigeria',
      hiring_region: 'Nigeria',
      hiring_locations: ['Nigeria'],
    });
    employerProfileRepository.findOne.mockResolvedValue(existing);

    const result = await service.updateProfile(userId, {
      companyName: '   ',
      companyWebsite: '   ',
      industry: '   ',
      region: '   ',
    });

    expect(result.profile).toMatchObject({
      company_name: 'Acme Labs',
      company_website: 'https://acme.example',
      website_url: 'https://acme.example',
      industry: 'Fintech',
      region: 'Nigeria',
      hiring_region: 'Nigeria',
      hiring_locations: ['Nigeria'],
    });
  });

  describe('getPublicProfile', () => {
    it('should return a public profile with is_new_to_platform true for new accounts', async () => {
      const recentDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      employerProfileRepository.findOne.mockResolvedValue({
        company_name: 'Acme Labs',
        industry: 'Fintech',
        company_size: '11-50',
        company_website: 'https://acme.example',
        website_url: null,
        linkedin_company_page_url: 'https://linkedin.com/company/acme',
        linkedin_company_url: null,
        region: 'Nigeria',
        hiring_region: null,
        is_verified: true,
        hire_count: 0,
        user: { createdAt: recentDate },
      });

      const result = await service.getPublicProfile('employer-user-1');

      expect(result.company_name).toBe('Acme Labs');
      expect(result.is_verified).toBe(true);
      expect(result.is_new_to_platform).toBe(true);
      expect(result.hire_count).toBeUndefined();
      expect(result.member_since).toBe(recentDate.toISOString());
    });

    it('should return is_new_to_platform false for accounts older than 90 days', async () => {
      const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000); // 120 days ago
      employerProfileRepository.findOne.mockResolvedValue({
        company_name: 'OldCorp',
        industry: 'Healthtech',
        company_size: '51-200',
        company_website: null,
        website_url: 'https://oldcorp.example',
        linkedin_company_page_url: null,
        linkedin_company_url: 'https://linkedin.com/company/oldcorp',
        region: null,
        hiring_region: 'Kenya',
        is_verified: false,
        hire_count: 5,
        user: { createdAt: oldDate },
      });

      const result = await service.getPublicProfile('employer-user-1');

      expect(result.is_new_to_platform).toBe(false);
      expect(result.company_website).toBe('https://oldcorp.example');
      expect(result.linkedin_company_url).toBe(
        'https://linkedin.com/company/oldcorp',
      );
      expect(result.region).toBe('Kenya');
    });

    it('should throw NotFoundError if employer profile not found', async () => {
      employerProfileRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getPublicProfile('nonexistent-user'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('notification mapping helpers', () => {
    it('maps employer notification types to product-doc aliases', () => {
      expect(
        mapEmployerNotificationType(
          NotificationType.JOB_READY_MATCHES_AVAILABLE,
        ),
      ).toBe('new_matching_talent');
      expect(mapEmployerNotificationType(NotificationType.OFFER_ACCEPTED)).toBe(
        'offer_accepted_assessment_unlocked',
      );
      expect(
        mapEmployerNotificationType(NotificationType.ASSESSMENT_PASSED),
      ).toBe('candidate_passed');
      expect(
        mapEmployerNotificationType(NotificationType.ASSESSMENT_FAILED),
      ).toBe('candidate_failed');
      expect(mapEmployerNotificationType(NotificationType.OFFER_DECLINED)).toBe(
        'offer_declined',
      );
    });

    it('builds links from notification data', () => {
      expect(buildEmployerNotificationLink({ offerId: 'offer-1' })).toEqual({
        entity_id: 'offer-1',
        entity_type: 'offer',
      });
      expect(
        buildEmployerNotificationLink({ assessmentId: 'assessment-1' }),
      ).toEqual({ entity_id: 'assessment-1', entity_type: 'assessment' });
      expect(
        buildEmployerNotificationLink({ candidateUserId: 'candidate-1' }),
      ).toEqual({ entity_id: 'candidate-1', entity_type: 'candidate' });
      expect(
        buildEmployerNotificationLink({ candidateUserIds: ['c-1'] }),
      ).toEqual({ entity_id: null, entity_type: 'discovery' });
      expect(buildEmployerNotificationLink(null)).toBeNull();
    });

    it('maps a notification list item to the employer item shape', () => {
      expect(
        toEmployerNotificationItem({
          id: 'notif-3',
          type: NotificationType.OFFER_DECLINED,
          title: 'Offer declined',
          body: 'John declined your offer',
          data: { candidate_user_id: 'candidate-2' },
          is_read: false,
          read_at: null,
          created_at: '2026-06-03T10:00:00.000Z',
        }),
      ).toEqual({
        notification_id: 'notif-3',
        type: 'offer_declined',
        message: 'John declined your offer',
        timestamp: '2026-06-03T10:00:00.000Z',
        read: false,
        link: { entity_id: 'candidate-2', entity_type: 'candidate' },
        data: { candidate_user_id: 'candidate-2' },
      });
    });
  });
});
