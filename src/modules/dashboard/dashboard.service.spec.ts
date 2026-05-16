import { Repository } from 'typeorm';
import { ForbiddenError } from '../../shared';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../talent/entities/talent-profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let usersService: Pick<UsersService, 'findOne'>;
  let talentProfileRepository: Pick<Repository<TalentProfile>, 'findOne'>;

  beforeEach(() => {
    usersService = {
      findOne: jest.fn(),
    };

    talentProfileRepository = {
      findOne: jest.fn(),
    };

    service = new DashboardService(
      talentProfileRepository as Repository<TalentProfile>,
      usersService as UsersService,
    );
  });

  it('returns 0 when the talent profile does not exist', async () => {
    const talentUser = makeUser({
      first_name: 'Casey',
      role: UserRole.TALENT,
      avatar_url: null,
      onboarding_complete: false,
    });

    (usersService.findOne as jest.Mock).mockResolvedValue(talentUser);
    (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.getHome(talentUser.id)).resolves.toEqual({
      firstName: 'Casey',
      profileCompletionPercentage: 0,
      journeyOverview: [
        { key: 'onboarding', title: 'Onboarding', status: 'active' },
        { key: 'assessment_1', title: 'Assessment 1', status: 'locked' },
        { key: 'assessment_2', title: 'Assessment 2', status: 'locked' },
        { key: 'assessment_3', title: 'Assessment 3', status: 'locked' },
      ],
    });
  });

  it('returns 56 for a partially completed talent profile', async () => {
    const talentUser = makeUser({
      first_name: 'Casey',
      role: UserRole.TALENT,
      avatar_url: null,
      onboarding_complete: false,
    });

    const profile = makeProfile({
      onboarding_step: 2,
      goal: 'land_first_role',
      track: 'frontend_developer',
      region: 'Lagos',
      profile_verified: true,
      status: TalentProfileStatus.IN_PROGRESS,
    });

    (usersService.findOne as jest.Mock).mockResolvedValue(talentUser);
    (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);

    await expect(service.getHome(talentUser.id)).resolves.toEqual({
      firstName: 'Casey',
      profileCompletionPercentage: 56,
      journeyOverview: [
        { key: 'onboarding', title: 'Onboarding', status: 'active' },
        { key: 'assessment_1', title: 'Assessment 1', status: 'locked' },
        { key: 'assessment_2', title: 'Assessment 2', status: 'locked' },
        { key: 'assessment_3', title: 'Assessment 3', status: 'locked' },
      ],
    });
  });

  it('returns 100 for a completed talent profile', async () => {
    const talentUser = makeUser({
      first_name: 'Jane',
      role: UserRole.TALENT,
      avatar_url: 'https://cdn.example.com/avatar.png',
      onboarding_complete: true,
    });

    const profile = makeProfile({
      onboarding_step: 3,
      profile_verified: false,
      goal: 'land_first_role',
      track: 'frontend_developer',
      role_tracks: ['frontend_developer'],
      region: 'Lagos',
      education_level: 'bachelors',
      linkedin_url: 'https://linkedin.com/in/jane',
      bio: 'I build things',
      status: TalentProfileStatus.JOB_READY,
    });

    (usersService.findOne as jest.Mock).mockResolvedValue(talentUser);
    (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);

    await expect(service.getHome(talentUser.id)).resolves.toEqual({
      firstName: 'Jane',
      profileCompletionPercentage: 100,
      journeyOverview: [
        { key: 'onboarding', title: 'Onboarding', status: 'complete' },
        { key: 'assessment_1', title: 'Assessment 1', status: 'active' },
        { key: 'assessment_2', title: 'Assessment 2', status: 'locked' },
        { key: 'assessment_3', title: 'Assessment 3', status: 'locked' },
      ],
    });
  });

  it('rejects non-talent users', async () => {
    const employerUser = makeUser({
      first_name: 'Emeka',
      role: UserRole.EMPLOYER,
      onboarding_complete: true,
    });

    (usersService.findOne as jest.Mock).mockResolvedValue(employerUser);

    await expect(service.getHome(employerUser.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

function makeUser(overrides: Partial<User>): User {
  return Object.assign(new User(), {
    id: 'user-1',
    email: 'user@example.com',
    first_name: 'Test',
    last_name: 'User',
    avatar_url: null,
    country: 'Nigeria',
    is_verified: true,
    onboarding_complete: false,
    role: UserRole.TALENT,
    signup_reason: null,
    refreshTokenHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });
}

function makeProfile(overrides: Partial<TalentProfile>): TalentProfile {
  return Object.assign(new TalentProfile(), {
    id: 'profile-1',
    user_id: 'user-1',
    role_track: null,
    role_tracks: null,
    goal: null,
    region: null,
    education_level: null,
    linkedin_url: null,
    track: null,
    profile_verified: false,
    onboarding_step: 0,
    status: TalentProfileStatus.NOT_STARTED,
    bio: null,
    profile_share_link: null,
    is_published: false,
    published_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });
}
