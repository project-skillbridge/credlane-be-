import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
} from '@nestjs/common';
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
  Reflector,
} from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { DashboardController } from '../src/modules/dashboard/dashboard.controller';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import {
  AssessmentAttempt,
  AssessmentResult,
  AssessmentTier,
  AssessmentType,
  VerifiedLevel,
} from '../src/modules/assessments/entities';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../src/modules/talent/entities/talent-profile.entity';
import { EmployerPoolProfile } from '../src/modules/talent/entities/employer-pool-profile.entity';
import { EmployerProfile } from '../src/modules/employer/entities/employer-profile.entity';
import { EmployerRole } from '../src/modules/employer-roles/entities/employer-role.entity';
import { EmployerSavedCandidate } from '../src/modules/employer-discovery/entities/employer-saved-candidate.entity';
import { EmployerAssessment } from '../src/modules/employer-assessments/entities/employer-assessment.entity';
import { EmployerAssessmentSubmission } from '../src/modules/employer-assessments/entities/employer-assessment-submission.entity';
import { Offer } from '../src/modules/offers/entities/offer.entity';
import { User, UserRole } from '../src/modules/users/entities/user.entity';
import { UsersService } from '../src/modules/users/users.service';
import { DashboardJourneyStatus } from '../src/modules/dashboard/dto/dashboard-home.dto';
import { NotificationDispatchService } from '../src/modules/notifications/notification-dispatch.service';

type AuthUser = {
  sub: string;
  email: string;
  role: UserRole;
  onboarding_complete: boolean;
};

@Injectable()
class MockJwtAuthGuard implements CanActivate {
  static nextUser: AuthUser = {
    sub: 'talent-user',
    email: 'talent@example.com',
    role: UserRole.TALENT,
    onboarding_complete: false,
  };

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    request.user = MockJwtAuthGuard.nextUser;
    return true;
  }
}

describe('Dashboard home (e2e)', () => {
  let app: INestApplication<App>;

  const talentUser = makeUser({
    id: 'talent-user',
    first_name: 'Casey',
    role: UserRole.TALENT,
    avatar_url: 'https://cdn.example.com/avatar.png',
    onboarding_complete: true,
  });

  const employerUser = makeUser({
    id: 'employer-user',
    first_name: 'Efe',
    role: UserRole.EMPLOYER,
    onboarding_complete: true,
  });

  const talentProfile = makeProfile({
    user_id: talentUser.id,
    onboarding_step: 3,
    profile_verified: true,
    goal: 'land_first_role',
    track: 'frontend_developer',
    region: 'Lagos',
    education_level: 'bachelors',
    linkedin_url: 'https://linkedin.com/in/casey',
    bio: 'Frontend developer',
    claimed_level: VerifiedLevel.MID,
    personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
    skill_assessment_completed_at: new Date('2026-05-02T00:00:00.000Z'),
    advanced_assessment_completed_at: new Date('2026-05-03T00:00:00.000Z'),
    validated_level: VerifiedLevel.MID,
    advanced_retake_required: false,
    status: TalentProfileStatus.JOB_READY,
  });
  let currentTalentProfile: TalentProfile;

  const skillAssessmentResult = makeAssessmentResult({
    score: 8,
    max_score: 10,
    percentage: 80,
    validated_level: VerifiedLevel.MID,
  });

  const advancedAssessmentResult = makeAssessmentResult({
    score: 88,
    max_score: 110,
    percentage: 80,
    tier: AssessmentTier.JOB_READY,
    integrity_confidence: 'high',
  });

  function createAssessmentResultQueryBuilder() {
    let assessmentType: AssessmentType | undefined;

    const builder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockImplementation((_clause, params) => {
        if (params?.assessmentType) {
          assessmentType = params.assessmentType;
        }
        return builder;
      }),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockImplementation(() => {
        if (assessmentType === AssessmentType.SKILL) {
          return Promise.resolve(skillAssessmentResult);
        }
        if (assessmentType === AssessmentType.ADVANCED) {
          return Promise.resolve(advancedAssessmentResult);
        }
        return Promise.resolve(null);
      }),
    };

    return builder;
  }

  beforeEach(async () => {
    currentTalentProfile = talentProfile;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        DashboardService,
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn().mockImplementation((id: string) => {
              if (id === talentUser.id) return Promise.resolve(talentUser);
              if (id === employerUser.id) return Promise.resolve(employerUser);
              return Promise.reject(new Error(`User ${id} not found`));
            }),
          },
        },
        {
          provide: getRepositoryToken(AssessmentResult),
          useValue: {
            createQueryBuilder: jest.fn(() =>
              createAssessmentResultQueryBuilder(),
            ),
          },
        },
        {
          provide: getRepositoryToken(AssessmentAttempt),
          useValue: {
            count: jest.fn().mockResolvedValue(0),
            findOne: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: getRepositoryToken(TalentProfile),
          useValue: {
            findOne: jest
              .fn()
              .mockImplementation(
                ({ where }: { where: { user_id: string } }) => {
                  if (where.user_id === talentUser.id)
                    return Promise.resolve(currentTalentProfile);
                  return Promise.resolve(null);
                },
              ),
          },
        },
        {
          provide: getRepositoryToken(EmployerProfile),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: getRepositoryToken(EmployerRole),
          useValue: {
            count: jest.fn().mockResolvedValue(0),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(EmployerSavedCandidate),
          useValue: {
            count: jest.fn().mockResolvedValue(0),
            findOne: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: getRepositoryToken(EmployerAssessment),
          useValue: {
            count: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: getRepositoryToken(EmployerAssessmentSubmission),
          useValue: {
            createQueryBuilder: jest.fn(() => ({
              innerJoin: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({ cnt: '0' }),
              getOne: jest.fn().mockResolvedValue(null),
            })),
          },
        },
        {
          provide: getRepositoryToken(Offer),
          useValue: {
            count: jest.fn().mockResolvedValue(0),
            findOne: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: getRepositoryToken(EmployerPoolProfile),
          useValue: {
            count: jest.fn().mockResolvedValue(0),
            findOne: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: NotificationDispatchService,
          useValue: {
            notifyAdvancedRetakeIfEligible: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
        { provide: APP_GUARD, useClass: MockJwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
        { provide: Reflector, useValue: new Reflector() },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['/', 'health', 'api', 'api/v1', 'api/docs', 'probe'],
    });
    await app.init();
  });

  it('GET /api/v1/dashboard/home returns the wrapped talent summary', () => {
    MockJwtAuthGuard.nextUser = {
      sub: talentUser.id,
      email: talentUser.email,
      role: UserRole.TALENT,
      onboarding_complete: true,
    };

    return request(app.getHttpServer())
      .get('/api/v1/dashboard/home')
      .expect(200)
      .expect((res) => {
        expect(res.body.status_code).toBe(200);
        expect(res.body.message).toBe('success');
        expect(res.body.data).toEqual({
          first_name: 'Casey',
          avatar_url: 'https://cdn.example.com/avatar.png',
          goal: 'land_first_role',
          profile_completion_percentage: 100,
          journey_overview: [
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
              status: DashboardJourneyStatus.COMPLETED,
            },
          ],
          performance: {
            skill: {
              score: 8,
              max_score: 10,
              percentage: 80,
              validated_level: VerifiedLevel.MID,
              passed: true,
              completed_at: '2026-05-02T00:00:00.000Z',
              attempts_used: 0,
              attempts_remaining: 3,
              failed: false,
            },
            advanced: {
              score: 88,
              max_score: 110,
              percentage: 80,
              tier: AssessmentTier.JOB_READY,
              tier_label: 'Job Ready',
              integrity_confidence: 'high',
              completed_at: '2026-05-03T00:00:00.000Z',
            },
          },
          skill_attempts_used: 0,
          skill_max_attempts: 3,
        });
      });
  });

  it('GET /api/v1/dashboard/home rejects employers', () => {
    MockJwtAuthGuard.nextUser = {
      sub: employerUser.id,
      email: employerUser.email,
      role: UserRole.EMPLOYER,
      onboarding_complete: true,
    };

    return request(app.getHttpServer())
      .get('/api/v1/dashboard/home')
      .expect(403)
      .expect((res) => {
        expect(res.body.status_code).toBe(403);
        expect(res.body.message).toBe('Insufficient permissions');
      });
  });

  it('GET /api/v1/dashboard/home includes locked advanced retake metadata', async () => {
    const now = new Date('2026-05-21T00:00:00.000Z');
    const probationStartDate = new Date('2026-05-10T00:00:00.000Z');
    const eligibilityDate = new Date('2026-05-24T00:00:00.000Z');
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

    currentTalentProfile = makeProfile({
      user_id: talentUser.id,
      onboarding_step: 3,
      profile_verified: true,
      goal: 'land_first_role',
      track: 'frontend_developer',
      region: 'Lagos',
      education_level: 'bachelors',
      claimed_level: VerifiedLevel.MID,
      personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
      skill_assessment_completed_at: new Date('2026-05-02T00:00:00.000Z'),
      advanced_assessment_completed_at: new Date('2026-05-20T00:00:00.000Z'),
      validated_level: VerifiedLevel.MID,
      assessment_locked_from: probationStartDate,
      assessment_locked_until: eligibilityDate,
      advanced_retake_required: true,
      status: TalentProfileStatus.EMERGING,
    });

    MockJwtAuthGuard.nextUser = {
      sub: talentUser.id,
      email: talentUser.email,
      role: UserRole.TALENT,
      onboarding_complete: true,
    };

    try {
      await request(app.getHttpServer())
        .get('/api/v1/dashboard/home')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.advanced_retake).toEqual({
            probation_start_date: probationStartDate.toISOString(),
            probation_end_date: eligibilityDate.toISOString(),
            eligibility_date: eligibilityDate.toISOString(),
            countdown_seconds: 3 * 24 * 60 * 60,
            days_remaining: 3,
            cta_enabled: false,
          });
        });
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  afterEach(async () => {
    if (app) await app.close();
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
    assessment_locked_from: null,
    assessment_locked_until: null,
    advanced_retake_required: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });
}
