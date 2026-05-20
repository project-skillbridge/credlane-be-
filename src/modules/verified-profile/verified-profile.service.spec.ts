import { Repository } from 'typeorm';
import { ForbiddenError, NotFoundError } from '../../shared';
import {
  AssessmentAttempt,
  AssessmentResponse,
  AssessmentResult,
  AssessmentTier,
  AssessmentType,
  VerifiedLevel,
} from '../assessments/entities';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../talent/entities/talent-profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { VerifiedProfileService } from './verified-profile.service';

describe('VerifiedProfileService', () => {
  let service: VerifiedProfileService;
  let usersService: Pick<UsersService, 'findOne'>;
  let talentProfileRepository: Pick<Repository<TalentProfile>, 'findOne'>;
  let employerPoolRepository: Pick<
    Repository<EmployerPoolProfile>,
    'findOne'
  >;
  let assessmentResultRepository: Pick<
    Repository<AssessmentResult>,
    'createQueryBuilder'
  >;
  let assessmentAttemptRepository: Pick<
    Repository<AssessmentAttempt>,
    'findOne'
  >;
  let assessmentResponseRepository: Pick<
    Repository<AssessmentResponse>,
    'find'
  >;
  let resultQueryBuilder: {
    innerJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    getOne: jest.Mock;
  };
  let lastAssessmentType: AssessmentType | undefined;

  beforeEach(() => {
    usersService = { findOne: jest.fn() };
    talentProfileRepository = { findOne: jest.fn() };
    employerPoolRepository = { findOne: jest.fn() };

    lastAssessmentType = undefined;
    resultQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockImplementation((_clause, params) => {
        if (params?.assessmentType) {
          lastAssessmentType = params.assessmentType;
        }
        return resultQueryBuilder;
      }),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    assessmentResultRepository = {
      createQueryBuilder: jest.fn(() => resultQueryBuilder as never),
    };
    assessmentAttemptRepository = { findOne: jest.fn().mockResolvedValue(null) };
    assessmentResponseRepository = { find: jest.fn().mockResolvedValue([]) };

    service = new VerifiedProfileService(
      talentProfileRepository as Repository<TalentProfile>,
      employerPoolRepository as Repository<EmployerPoolProfile>,
      assessmentResultRepository as Repository<AssessmentResult>,
      assessmentAttemptRepository as never,
      assessmentResponseRepository as never,
      usersService as UsersService,
    );
  });

  it('returns a verified profile for a job-ready talent', async () => {
    const user = makeUser();
    const profile = makeProfile({
      status: TalentProfileStatus.JOB_READY,
      goal: 'land_first_role',
      bio: 'Builder of useful products',
      track: 'frontend_developer',
      validated_level: VerifiedLevel.MID,
      personal_assessment_answers: {
        tools: ['react', 'typescript'],
        specialization: 'frontend_engineer',
      },
      advanced_assessment_completed_at: new Date('2026-05-03T00:00:00.000Z'),
    });

    (usersService.findOne as jest.Mock).mockResolvedValue(user);
    (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
    (resultQueryBuilder.getOne as jest.Mock).mockImplementation(() => {
      if (lastAssessmentType === AssessmentType.ADVANCED) {
        return Promise.resolve(
          makeResult({ tier: AssessmentTier.JOB_READY, percentage: 80 }),
        );
      }
      if (lastAssessmentType === AssessmentType.SKILL) {
        return Promise.resolve(makeResult({ percentage: 82 }));
      }
      return Promise.resolve(null);
    });

    await expect(service.getForTalentUser(user.id)).resolves.toEqual({
      fullName: 'Jane Doe',
      role: 'Frontend Engineer',
      goal: 'Land First Role',
      about: 'Builder of useful products',
      skills: ['react', 'typescript'],
      skillProficiency: {
        validatedLevel: VerifiedLevel.MID,
        skillAssessmentPercentage: 82,
      },
      verifiedAt: '2026-05-03T00:00:00.000Z',
      tier: AssessmentTier.JOB_READY,
    });
  });

  it('rejects non-talent users', async () => {
    (usersService.findOne as jest.Mock).mockResolvedValue(
      makeUser({ role: UserRole.EMPLOYER }),
    );

    await expect(service.getForTalentUser('user-1')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects talents who are not job-ready', async () => {
    const user = makeUser();
    const profile = makeProfile({
      status: TalentProfileStatus.EMERGING,
      advanced_assessment_completed_at: new Date(),
    });

    (usersService.findOne as jest.Mock).mockResolvedValue(user);
    (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
    (resultQueryBuilder.getOne as jest.Mock).mockResolvedValue(
      makeResult({ tier: AssessmentTier.EMERGING }),
    );

    await expect(service.getForTalentUser(user.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('loads a verified profile by share token', async () => {
    const user = makeUser();
    const profile = makeProfile({
      status: TalentProfileStatus.JOB_READY,
      track: 'backend_developer',
      bio: 'API specialist',
    });
    const pool = Object.assign(new EmployerPoolProfile(), {
      candidate_id: user.id,
      talent_profile: profile,
      shareable_link_token: 'abc123',
      verified_at: new Date('2026-05-04T00:00:00.000Z'),
      specialization: 'api_engineering',
      verified_level: VerifiedLevel.SENIOR,
    });

    (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(pool);
    (usersService.findOne as jest.Mock).mockResolvedValue(user);
    (resultQueryBuilder.getOne as jest.Mock).mockImplementation(() => {
      if (lastAssessmentType === AssessmentType.ADVANCED) {
        return Promise.resolve(
          makeResult({ tier: AssessmentTier.JOB_READY }),
        );
      }
      return Promise.resolve(null);
    });

    await expect(service.getByShareToken('abc123')).resolves.toMatchObject({
      fullName: 'Jane Doe',
      role: 'Api Engineering',
      about: 'API specialist',
      verifiedAt: '2026-05-04T00:00:00.000Z',
      skillProficiency: { validatedLevel: VerifiedLevel.MID },
    });
  });
});

function makeUser(overrides: Partial<User> = {}): User {
  return Object.assign(new User(), {
    id: 'user-1',
    email: 'jane@example.com',
    first_name: 'Jane',
    last_name: 'Doe',
    country: 'Nigeria',
    role: UserRole.TALENT,
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
    onboarding_step: 3,
    status: TalentProfileStatus.NOT_STARTED,
    bio: null,
    personal_assessment_answers: null,
    personal_assessment_completed_at: null,
    skill_assessment_completed_at: null,
    advanced_assessment_completed_at: null,
    validated_level: VerifiedLevel.MID,
    assessment_locked_until: null,
    ...overrides,
  });
}

function makeResult(overrides: Partial<AssessmentResult>): AssessmentResult {
  return Object.assign(new AssessmentResult(), {
    id: 'result-1',
    attempt_id: 'attempt-1',
    score: 80,
    max_score: 100,
    percentage: 80,
    tier: AssessmentTier.JOB_READY,
    validated_level: null,
    created_at: new Date('2026-05-03T00:00:00.000Z'),
    ...overrides,
  });
}
