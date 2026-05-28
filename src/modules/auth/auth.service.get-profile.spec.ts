import { AuthService } from './auth.service';
import { TalentProfileStatus } from '../talent/entities/talent-profile.entity';
import { UserRole } from '../users/entities/user.entity';

/**
 * Unit tests for AuthService.getProfile — verifies that linkedin_url and
 * is_job_ready are correctly derived from the talent profile and included
 * in the /auth/me response.
 */
describe('AuthService.getProfile — linkedin_url and is_job_ready', () => {
  let service: AuthService;

  let usersService: { findOne: jest.Mock };
  let talentProfileRepository: { findOne: jest.Mock };

  const baseUser = {
    id: 'user-1',
    email: 'alice@example.com',
    first_name: 'Alice',
    last_name: 'Smith',
    fullname: 'Alice Smith',
    avatar_url: null,
    country: 'Nigeria',
    role: UserRole.TALENT,
    is_verified: true,
    onboarding_complete: true,
  };

  beforeEach(() => {
    usersService = { findOne: jest.fn().mockResolvedValue(baseUser) };
    talentProfileRepository = { findOne: jest.fn() };

    service = new AuthService(
      usersService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      talentProfileRepository as never,
    );
  });

  it('returns linkedin_url from the talent profile when set', async () => {
    talentProfileRepository.findOne.mockResolvedValue({
      track: 'frontend_developer',
      linkedin_url: 'https://www.linkedin.com/in/alicesmith',
      status: TalentProfileStatus.IN_PROGRESS,
    });

    const result = await service.getProfile('user-1');

    expect(result.linkedin_url).toBe('https://www.linkedin.com/in/alicesmith');
  });

  it('returns linkedin_url as null when not set on the profile', async () => {
    talentProfileRepository.findOne.mockResolvedValue({
      track: 'frontend_developer',
      linkedin_url: null,
      status: TalentProfileStatus.IN_PROGRESS,
    });

    const result = await service.getProfile('user-1');

    expect(result.linkedin_url).toBeNull();
  });

  it('returns is_job_ready true when profile status is JOB_READY', async () => {
    talentProfileRepository.findOne.mockResolvedValue({
      track: 'frontend_developer',
      linkedin_url: null,
      status: TalentProfileStatus.JOB_READY,
    });

    const result = await service.getProfile('user-1');

    expect(result.is_job_ready).toBe(true);
  });

  it('returns is_job_ready false for any non-JOB_READY status', async () => {
    for (const status of [
      TalentProfileStatus.NOT_STARTED,
      TalentProfileStatus.IN_PROGRESS,
      TalentProfileStatus.NOT_READY,
      TalentProfileStatus.EMERGING,
    ]) {
      talentProfileRepository.findOne.mockResolvedValue({
        track: null,
        linkedin_url: null,
        status,
      });

      const result = await service.getProfile('user-1');
      expect(result.is_job_ready).toBe(false);
    }
  });

  it('returns linkedin_url null and is_job_ready false when profile does not exist', async () => {
    talentProfileRepository.findOne.mockResolvedValue(null);

    const result = await service.getProfile('user-1');

    expect(result.linkedin_url).toBeNull();
    expect(result.is_job_ready).toBe(false);
  });
});
