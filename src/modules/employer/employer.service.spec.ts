import { NotFoundException } from '@nestjs/common';
import { EmployerService } from './employer.service';
import { EmployerProfile } from './entities/employer-profile.entity';

describe('EmployerService', () => {
  const userId = 'employer-user-1';

  let manager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let employerProfileRepository: {
    manager: { transaction: jest.Mock };
  };
  let authService: { issueSessionForUser: jest.Mock };
  let usersService: {
    getUserForOnboarding: jest.Mock;
    markOnboardingCompleteWithManager: jest.Mock;
  };
  let service: EmployerService;

  beforeEach(() => {
    manager = {
      findOne: jest.fn(),
      create: jest.fn((_entity, payload) => ({ ...payload })),
      save: jest.fn((_entity, payload) => Promise.resolve(payload)),
    };
    employerProfileRepository = {
      manager: {
        transaction: jest.fn((callback) => callback(manager)),
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
    service = new EmployerService(
      employerProfileRepository as never,
      authService as never,
      usersService as never,
      {
        checkAndUpdateVerification: jest.fn().mockResolvedValue(true),
      } as never,
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
});
