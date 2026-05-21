import { Repository } from 'typeorm';
import { ForbiddenError } from '../../shared';
import {
  AssessmentAttempt,
  AssessmentResult,
  AssessmentTier,
  AssessmentType,
  VerifiedLevel,
} from '../assessments/entities';
import { SKILL_ASSESSMENT_MAX_ATTEMPTS } from '../talent/talent.constants';
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
  let assessmentAttemptRepository: Pick<Repository<AssessmentAttempt>, 'count'>;
  let notificationDispatch: { notifyAdvancedRetakeIfEligible: jest.Mock };
  let queryBuilder: {
    innerJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    getOne: jest.Mock;
  };
  let lastAssessmentType: AssessmentType | undefined;

  beforeEach(() => {
    usersService = {
      findOne: jest.fn(),
    };

    talentProfileRepository = {
      findOne: jest.fn(),
    };

    lastAssessmentType = undefined;
    queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockImplementation((_clause, params) => {
        if (params?.assessmentType) {
          lastAssessmentType = params.assessmentType;
        }
        return queryBuilder;
      }),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    assessmentResultRepository = {
      createQueryBuilder: jest.fn(() => queryBuilder as any),
    };

    assessmentAttemptRepository = {
      count: jest.fn().mockResolvedValue(0),
    };

    notificationDispatch = {
      notifyAdvancedRetakeIfEligible: jest.fn().mockResolvedValue(undefined),
    };

    service = new DashboardService(
      talentProfileRepository as Repository<TalentProfile>,
      usersService as UsersService,
      assessmentResultRepository as Repository<AssessmentResult>,
      assessmentAttemptRepository as Repository<AssessmentAttempt>,
      notificationDispatch as never,
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
      performance: { skill: null, advanced: null },
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
      performance: { skill: null, advanced: null },
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
      performance: { skill: null, advanced: null },
    });
  });

  it('locks skill assessment when three attempts are exhausted and advanced is incomplete', async () => {
    const talentUser = makeUser({
      first_name: 'Jane',
      role: UserRole.TALENT,
      onboarding_complete: true,
    });

    const profile = makeProfile({
      onboarding_step: 3,
      goal: 'land_first_role',
      track: 'frontend_developer',
      region: 'Lagos',
      education_level: 'bachelors',
      claimed_level: VerifiedLevel.MID,
      personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
      skill_assessment_completed_at: null,
      advanced_assessment_completed_at: null,
      status: TalentProfileStatus.IN_PROGRESS,
    });

    (usersService.findOne as jest.Mock).mockResolvedValue(talentUser);
    (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
    (assessmentAttemptRepository.count as jest.Mock).mockResolvedValue(
      SKILL_ASSESSMENT_MAX_ATTEMPTS,
    );

    const home = await service.getHome(talentUser.id);
    const skillJourney = home.journeyOverview.find(
      (item) => item.key === 'skill',
    );

    expect(skillJourney?.status).toBe(DashboardJourneyStatus.LOCKED);
    expect(assessmentAttemptRepository.count).toHaveBeenCalled();
  });

  it('keeps skill assessment available when attempts remain before advanced', async () => {
    const talentUser = makeUser({
      first_name: 'Jane',
      role: UserRole.TALENT,
      onboarding_complete: true,
    });

    const profile = makeProfile({
      onboarding_step: 3,
      goal: 'land_first_role',
      track: 'frontend_developer',
      region: 'Lagos',
      education_level: 'bachelors',
      claimed_level: VerifiedLevel.MID,
      personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
      skill_assessment_completed_at: null,
      advanced_assessment_completed_at: null,
      status: TalentProfileStatus.IN_PROGRESS,
    });

    (usersService.findOne as jest.Mock).mockResolvedValue(talentUser);
    (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
    (assessmentAttemptRepository.count as jest.Mock).mockResolvedValue(
      SKILL_ASSESSMENT_MAX_ATTEMPTS - 1,
    );

    const home = await service.getHome(talentUser.id);
    const skillJourney = home.journeyOverview.find(
      (item) => item.key === 'skill',
    );

    expect(skillJourney?.status).toBe(DashboardJourneyStatus.AVAILABLE);
  });

  it('shows advanced retake countdown without locking skill assessment', async () => {
    const talentUser = makeUser({
      first_name: 'Jane',
      role: UserRole.TALENT,
      onboarding_complete: true,
    });
    const eligibilityDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const profile = makeProfile({
      onboarding_step: 3,
      goal: 'land_first_role',
      track: 'frontend_developer',
      region: 'Lagos',
      education_level: 'bachelors',
      claimed_level: VerifiedLevel.MID,
      personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
      skill_assessment_completed_at: new Date('2026-05-02T00:00:00.000Z'),
      advanced_assessment_completed_at: new Date(),
      advanced_retake_required: true,
      assessment_locked_until: eligibilityDate,
      status: TalentProfileStatus.EMERGING,
    });

    (usersService.findOne as jest.Mock).mockResolvedValue(talentUser);
    (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);

    const home = await service.getHome(talentUser.id);
    const skillJourney = home.journeyOverview.find(
      (item) => item.key === 'skill',
    );
    const advancedJourney = home.journeyOverview.find(
      (item) => item.key === 'advanced',
    );

    expect(skillJourney?.status).toBe(DashboardJourneyStatus.COMPLETED);
    expect(advancedJourney?.status).toBe(DashboardJourneyStatus.LOCKED);
    expect(home.advancedRetake).toMatchObject({
      eligibilityDate: eligibilityDate.toISOString(),
      ctaEnabled: false,
      daysRemaining: 3,
    });
    expect(home.advancedRetake?.countdownSeconds).toBeGreaterThan(0);
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
    (queryBuilder.getOne as jest.Mock).mockImplementation(() => {
      if (lastAssessmentType === AssessmentType.SKILL) {
        return Promise.resolve(
          makeAssessmentResult({
            percentage: 80,
            validated_level: VerifiedLevel.MID,
          }),
        );
      }
      return Promise.resolve(null);
    });

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
      performance: {
        skill: {
          score: 8,
          maxScore: 10,
          percentage: 80,
          validatedLevel: VerifiedLevel.MID,
          passed: true,
          completedAt: '2026-05-02T00:00:00.000Z',
        },
        advanced: null,
      },
    });
  });

  it('returns skill and advanced performance from the latest assessment results', async () => {
    const talentUser = makeUser({
      first_name: 'Jane',
      role: UserRole.TALENT,
      onboarding_complete: true,
    });

    const profile = makeProfile({
      onboarding_step: 3,
      track: 'frontend_developer',
      region: 'Lagos',
      education_level: 'bachelors',
      claimed_level: VerifiedLevel.MID,
      personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
      skill_assessment_completed_at: new Date('2026-05-02T00:00:00.000Z'),
      advanced_assessment_completed_at: new Date('2026-05-03T00:00:00.000Z'),
      validated_level: VerifiedLevel.MID,
      status: TalentProfileStatus.JOB_READY,
    });

    (usersService.findOne as jest.Mock).mockResolvedValue(talentUser);
    (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
    (queryBuilder.getOne as jest.Mock).mockImplementation(() => {
      if (lastAssessmentType === AssessmentType.SKILL) {
        return Promise.resolve(
          makeAssessmentResult({
            score: 8,
            max_score: 10,
            percentage: 80,
            validated_level: VerifiedLevel.MID,
          }),
        );
      }
      if (lastAssessmentType === AssessmentType.ADVANCED) {
        return Promise.resolve(
          makeAssessmentResult({
            score: 88,
            max_score: 110,
            percentage: 80,
            tier: AssessmentTier.JOB_READY,
            integrity_confidence: 'high',
          }),
        );
      }
      return Promise.resolve(null);
    });

    await expect(service.getHome(talentUser.id)).resolves.toMatchObject({
      firstName: 'Jane',
      profileCompletionPercentage: 84,
      performance: {
        skill: {
          score: 8,
          maxScore: 10,
          percentage: 80,
          validatedLevel: VerifiedLevel.MID,
          passed: true,
          completedAt: '2026-05-02T00:00:00.000Z',
        },
        advanced: {
          score: 88,
          maxScore: 110,
          percentage: 80,
          tier: AssessmentTier.JOB_READY,
          tierLabel: 'Job Ready',
          integrityConfidence: 'high',
          completedAt: '2026-05-03T00:00:00.000Z',
        },
      },
    });
    expect(queryBuilder.getOne).toHaveBeenCalled();
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
    advanced_retake_required: false,
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
