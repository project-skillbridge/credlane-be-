import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveEmployerProfileDto } from './save-employer-profile.dto';
import { CompleteEmployerOnboardingDto } from './complete-employer-onboarding.dto';

describe('Employer onboarding DTOs', () => {
  it('requires the doc-aligned fields on the profile onboarding payload', async () => {
    const dto = plainToInstance(SaveEmployerProfileDto, {
      employer_type: 'Recruiter',
      company_name: 'Acme Labs',
      company_size: '11-50',
      company_website: 'https://acme.example',
      industry: 'Fintech',
      region: 'Nigeria',
      hiring_roles: ['frontend_developer'],
      preferred_experience_levels: ['junior', 'mid'],
      hiring_count: '6_10',
      linkedin_company_page_url: 'https://www.linkedin.com/company/acme-labs',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects profile onboarding without preferred experience levels', async () => {
    const dto = plainToInstance(SaveEmployerProfileDto, {
      employer_type: 'Recruiter',
      company_name: 'Acme Labs',
      company_size: '11-50',
      company_website: 'https://acme.example',
      industry: 'Fintech',
      region: 'Nigeria',
      hiring_roles: ['frontend_developer'],
    });

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'preferred_experience_levels'),
    ).toBe(true);
  });

  it('validates the legacy onboarding route with the expanded doc fields', async () => {
    const dto = plainToInstance(CompleteEmployerOnboardingDto, {
      joining_as: 'recruiter',
      company_name: 'Acme Labs',
      company_size: '11-50',
      industry: 'Fintech',
      desired_roles: ['backend_developer'],
      preferred_experience_levels: ['senior'],
      region: 'Kenya',
      hiring_count_range: '1_5',
      company_website: 'https://acme.example',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
