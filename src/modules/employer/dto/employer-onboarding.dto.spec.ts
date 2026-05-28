import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveEmployerProfileDto } from './save-employer-profile.dto';
import { CompleteEmployerOnboardingDto } from './complete-employer-onboarding.dto';

describe('Employer onboarding DTOs', () => {
  it('requires the doc-aligned fields on the profile onboarding payload', async () => {
    const dto = plainToInstance(SaveEmployerProfileDto, {
      employerType: 'Recruiter',
      companyName: 'Acme Labs',
      companySize: '11-50',
      companyWebsite: 'https://acme.example',
      industry: 'Fintech',
      region: 'Nigeria',
      hiringRoles: ['frontend_developer'],
      preferredExperienceLevels: ['junior', 'mid'],
      hiringCount: '6_10',
      linkedinCompanyPageUrl: 'https://www.linkedin.com/company/acme-labs',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects profile onboarding without preferred experience levels', async () => {
    const dto = plainToInstance(SaveEmployerProfileDto, {
      employerType: 'Recruiter',
      companyName: 'Acme Labs',
      companySize: '11-50',
      companyWebsite: 'https://acme.example',
      industry: 'Fintech',
      region: 'Nigeria',
      hiringRoles: ['frontend_developer'],
    });

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'preferredExperienceLevels'),
    ).toBe(true);
  });

  it('validates the legacy onboarding route with the expanded doc fields', async () => {
    const dto = plainToInstance(CompleteEmployerOnboardingDto, {
      joiningAs: 'recruiter',
      companyName: 'Acme Labs',
      companySize: '11-50',
      industry: 'Fintech',
      desiredRoles: ['backend_developer'],
      preferredExperienceLevels: ['senior'],
      region: 'Kenya',
      hiringCountRange: '1_5',
      companyWebsite: 'https://acme.example',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
