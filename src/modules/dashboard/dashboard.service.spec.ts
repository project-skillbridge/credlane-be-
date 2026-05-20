import { Repository } from 'typeorm';
import { ForbiddenError } from '../../shared';
import { AssessmentResult, VerifiedLevel } from '../assessments/entities';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../talent/entities/talent-profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { DashboardJourneyStatus } from './dto/dashboard-home.dto';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let usersService: Pick<UsersService, 'findOne'>;
  let talentProfileRepository: Pick<Repository<TalentProfile>, 'findOne'>;
  let assessmentResultRepository: Pick<
    Repository<AssessmentResult>,
    'createQueryBuilder'
  >;
  let queryBuilder: {
    innerJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    getOne: jest.Mock;
  };

  beforeEach(() => {
    usersService = {
      findOne: jest.fn(),
    };

    talentProfileRepository = {
      findOne: jest.fn(),
    };

    queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    assessmentResultRepository = {
      createQueryBuilder: jest.fn(() => queryBuilder as any),
    };

    service = new DashboardService(
      talentProfileRepository as Repository<TalentProfile>,
      usersService as UsersService,
      assessmentResultRepository as Repository<AssessmentResult>,
    );
  });

  it('returns locked assessments when the talent profile does not exist', async () => {
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
        {
          key: 'onboarding',
          title: 'Onboarding',
          status: DashboardJourneyStatus.AVAILABLE,
        },
        {
          key: 'personal',
          title: 'Personal Assessment',
          status: DashboardJourneyStatus.LOCKED,
        },
        {
          key: 'skill',
          title: 'Skill Assessment',
          status: DashboardJourneyStatus.LOCKED,
        },
        {
          key: 'advanced',
          title: 'Advanced Assessment',
          status: DashboardJourneyStatus.LOCKED,
        },
      ],
    });
  });

  it('returns locked personal assessment when onboarding fields are incomplete', async () => {
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
        {
          key: 'onboarding',
          title: 'Onboarding',
          status: DashboardJourneyStatus.AVAILABLE,
        },
        {
          key: 'personal',
          title: 'Personal Assessment',
          status: DashboardJourneyStatus.LOCKED,
        },
        {
          key: 'skill',
          title: 'Skill Assessment',
          status: DashboardJourneyStatus.LOCKED,
        },
        {
          key: 'advanced',
          title: 'Advanced Assessment',
          status: DashboardJourneyStatus.LOCKED,
        },
      ],
    });
  });

  it('returns an available personal assessment when onboarding is ready', async () => {
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
      education_level: 'bachelors',
      profile_verified: true,
      status: TalentProfileStatus.IN_PROGRESS,
    });

    (usersService.findOne as jest.Mock).mockResolvedValue(talentUser);
    (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);

    await expect(service.getHome(talentUser.id)).resolves.toEqual({
      firstName: 'Casey',
      profileCompletionPercentage: 64,
      journeyOverview: [
        {
          key: 'onboarding',
          title: 'Onboarding',
          status: DashboardJourneyStatus.AVAILABLE,
        },
        {
          key: 'personal',
          title: 'Personal Assessment',
          status: DashboardJourneyStatus.AVAILABLE,
        },
        {
          key: 'skill',
          title: 'Skill Assessment',
          status: DashboardJourneyStatus.LOCKED,
        },
        {
          key: 'advanced',
          title: 'Advanced Assessment',
          status: DashboardJourneyStatus.LOCKED,
        },
      ],
    });
  });

  it('returns completed personal and skill assessments and unlocks advanced when the latest skill score passes', async () => {
    const talentUser = makeUser({
      first_name: 'Jane',
      role: UserRole.TALENT,
      avatar_url: 'https://cdn.example.com/avatar.png',
      onboarding_complete: true,
    });

    const profile = makeProfile({
      onboarding_step: 3,
      goal: 'land_first_role',
      track: 'frontend_developer',
      region: 'Lagos',
      education_level: 'bachelors',
      linkedin_url: 'https://linkedin.com/in/jane',
      bio: 'I build things',
      claimed_level: VerifiedLevel.MID,
      personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
      skill_assessment_completed_at: new Date('2026-05-02T00:00:00.000Z'),
      validated_level: VerifiedLevel.MID,
      status: TalentProfileStatus.JOB_READY,
    });

    (usersService.findOne as jest.Mock).mockResolvedValue(talentUser);
    (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
    (queryBuilder.getOne as jest.Mock).mockResolvedValue(
      makeAssessmentResult({ percentage: 80 }),
    );

    await expect(service.getHome(talentUser.id)).resolves.toEqual({
      firstName: 'Jane',
      profileCompletionPercentage: 100,
      journeyOverview: [
        {
          key: 'onboarding',
          title: 'Onboarding',
          status: DashboardJourneyStatus.COMPLETED,
        },
        {
          key: 'personal',
          title: 'Personal Assessment',
          status: DashboardJourneyStatus.COMPLETED,
        },
        {
          key: 'skill',
          title: 'Skill Assessment',
          status: DashboardJourneyStatus.COMPLETED,
        },
        {
          key: 'advanced',
          title: 'Advanced Assessment',
          status: DashboardJourneyStatus.AVAILABLE,
        },
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
    claimed_level: null,
    onboarding_step: 0,
    status: TalentProfileStatus.NOT_STARTED,
    bio: null,
    profile_share_link: null,
    is_published: false,
    published_at: null,
    personal_assessment_answers: null,
    personal_assessment_completed_at: null,
    skill_assessment_completed_at: null,
    advanced_assessment_completed_at: null,
    validated_level: null,
    assessment_locked_until: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });
}

function makeAssessmentResult(
  overrides: Partial<AssessmentResult>,
): AssessmentResult {
  return Object.assign(new AssessmentResult(), {
    id: 'result-1',
    attempt_id: 'attempt-1',
    score: 8,
    max_score: 10,
    percentage: 80,
    tier: null,
    validated_level: null,
    guidance_report: null,
    integrity_confidence: null,
    created_at: new Date(),
    ...overrides,
  });
}
