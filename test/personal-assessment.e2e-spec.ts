import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  ValidationPipe,
} from '@nestjs/common';
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
  Reflector,
} from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PersonalAssessmentController } from '../src/modules/talent/assessment/personal-assessment.controller';
import { PersonalAssessmentService } from '../src/modules/talent/assessment/personal-assessment.service';
import {
  createTestPersonalAssessmentQuestionService,
  PersonalAssessmentQuestionService,
} from '../src/modules/talent/assessment/personal-assessment-question.service';
import {
  makeTalentProfile,
  makeTalentUser,
  section1Answers,
} from '../src/modules/talent/assessment/personal-assessment.test-fixtures';
import { TalentProfile } from '../src/modules/talent/entities/talent-profile.entity';
import { UserRole } from '../src/modules/users/entities/user.entity';
import { UsersService } from '../src/modules/users/users.service';

type AuthUser = {
  sub: string;
  email: string;
  role: UserRole;
  onboarding_complete: boolean;
};

@Injectable()
class MockJwtAuthGuard implements CanActivate {
  static nextUser: AuthUser = {
    sub: 'talent-user-1',
    email: 'talent@example.com',
    role: UserRole.TALENT,
    onboarding_complete: true,
  };

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    req.user = MockJwtAuthGuard.nextUser;
    return true;
  }
}

describe('Personal assessment (e2e)', () => {
  let app: INestApplication<App>;

  const talentUser = makeTalentUser();
  const employerUser = makeTalentUser({
    id: 'employer-user-1',
    email: 'employer@example.com',
    role: UserRole.EMPLOYER,
  });

  let profileStore: TalentProfile;

  beforeEach(async () => {
    profileStore = makeTalentProfile({ user_id: talentUser.id });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PersonalAssessmentController],
      providers: [
        PersonalAssessmentService,
        {
          provide: PersonalAssessmentQuestionService,
          useFactory: () => createTestPersonalAssessmentQuestionService(),
        },
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
          provide: getRepositoryToken(TalentProfile),
          useValue: (() => {
            const resolveProfile = (options?: {
              where?: { user_id: string };
            }) =>
              options?.where?.user_id === talentUser.id ? profileStore : null;

            const persistProfile = (profile: TalentProfile) => {
              profileStore = profile;
              return Promise.resolve(profile);
            };

            const entityManager = {
              findOne: jest
                .fn()
                .mockImplementation(
                  (
                    entityOrOptions: { where?: { user_id: string } },
                    maybeOptions?: { where?: { user_id: string } },
                  ) =>
                    Promise.resolve(
                      resolveProfile(maybeOptions ?? entityOrOptions),
                    ),
                ),
              create: jest
                .fn()
                .mockImplementation(
                  (_entity: unknown, data: Partial<TalentProfile>) => {
                    profileStore = makeTalentProfile({
                      ...data,
                      user_id: talentUser.id,
                    });
                    return profileStore;
                  },
                ),
              save: jest
                .fn()
                .mockImplementation(
                  (_entity: unknown, profile: TalentProfile) =>
                    persistProfile(profile),
                ),
            };

            return {
              findOne: entityManager.findOne,
              create: jest
                .fn()
                .mockImplementation((data: Partial<TalentProfile>) => {
                  profileStore = makeTalentProfile({
                    ...data,
                    user_id: talentUser.id,
                  });
                  return profileStore;
                }),
              save: jest
                .fn()
                .mockImplementation((profile: TalentProfile) =>
                  persistProfile(profile),
                ),
              manager: {
                transaction: jest
                  .fn()
                  .mockImplementation(
                    (
                      work: (manager: typeof entityManager) => Promise<unknown>,
                    ) => work(entityManager),
                  ),
              },
            };
          })(),
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        errorHttpStatusCode: 422,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('POST /api/v1/talent/assessment/personal/section/1 saves answers', async () => {
    MockJwtAuthGuard.nextUser = {
      sub: talentUser.id,
      email: talentUser.email,
      role: UserRole.TALENT,
      onboarding_complete: true,
    };

    await request(app.getHttpServer())
      .post('/api/v1/talent/assessment/personal/section/1')
      .send({ answers: section1Answers() })
      .expect(200)
      .expect((res) => {
        expect(res.body.status_code).toBe(200);
        expect(res.body.section).toBe(1);
        expect(res.body.status).toBe('success');
        expect(res.body.progress).toEqual({
          completedSections: [1],
          nextSection: 2,
          totalSections: 5,
          sectionsCompleted: 1,
          isComplete: false,
        });
      });
  });

  it('POST /api/v1/talent/assessment/personal/submit saves and completes generated answers', async () => {
    MockJwtAuthGuard.nextUser = {
      sub: talentUser.id,
      email: talentUser.email,
      role: UserRole.TALENT,
      onboarding_complete: true,
    };

    const startResponse = await request(app.getHttpServer())
      .post('/api/v1/talent/assessment/personal/start')
      .expect(201);

    expect(startResponse.body.data.session).toBeDefined();

    await request(app.getHttpServer())
      .post('/api/v1/talent/assessment/personal/submit')
      .send({ answers: { job_title: 'Software Engineer' } })
      .expect(200)
      .expect((res) => {
        expect(res.body.status_code).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.completedAt).toBeDefined();
      });
  });

  it('GET /api/v1/talent/assessment/personal/progress returns resume state', async () => {
    profileStore.personal_assessment_answers = {
      ...section1Answers(),
      _meta: { completedSections: [1, 2] },
    };
    MockJwtAuthGuard.nextUser = {
      sub: talentUser.id,
      email: talentUser.email,
      role: UserRole.TALENT,
      onboarding_complete: true,
    };

    await request(app.getHttpServer())
      .get('/api/v1/talent/assessment/personal/progress')
      .expect(200)
      .expect((res) => {
        expect(res.body.data.progress).toEqual({
          completedSections: [1, 2],
          nextSection: 3,
          totalSections: 5,
          sectionsCompleted: 2,
          isComplete: false,
        });
        expect(res.body.data.personalAssessmentCompleted).toBe(false);
      });
  });

  it('POST /api/v1/talent/assessment/personal/section/1 returns allowedValues on invalid enum', async () => {
    MockJwtAuthGuard.nextUser = {
      sub: talentUser.id,
      email: talentUser.email,
      role: UserRole.TALENT,
      onboarding_complete: true,
    };

    await request(app.getHttpServer())
      .post('/api/v1/talent/assessment/personal/section/1')
      .send({
        answers: { ...section1Answers(), years_experience: 'bad_value' },
      })
      .expect(422)
      .expect((res) => {
        expect(res.body.field).toBe('years_experience');
        expect(res.body.message).toContain('Valid values are:');
        expect(res.body.allowedValues).toEqual(
          expect.arrayContaining(['3_5_yrs']),
        );
      });
  });

  it('GET /api/v1/talent/assessment/personal/context returns merged payload', async () => {
    profileStore.personal_assessment_answers = section1Answers();
    MockJwtAuthGuard.nextUser = {
      sub: talentUser.id,
      email: talentUser.email,
      role: UserRole.TALENT,
      onboarding_complete: true,
    };

    await request(app.getHttpServer())
      .get('/api/v1/talent/assessment/personal/context')
      .expect(200)
      .expect((res) => {
        expect(res.body.data.track).toBe('frontend_developer');
        expect(res.body.data.skill_track).toBe('frontend_developer');
        expect(res.body.data.job_title).toBe('Software Engineer');
        expect(res.body.data.country).toBe('Nigeria');
        expect(res.body.data).not.toHaveProperty('answers');
        expect(res.body.data).not.toHaveProperty('onboarding');
      });
  });

  it('POST /api/v1/talent/assessment/personal/complete succeeds with stored generated answers', async () => {
    MockJwtAuthGuard.nextUser = {
      sub: talentUser.id,
      email: talentUser.email,
      role: UserRole.TALENT,
      onboarding_complete: true,
    };

    const startResponse = await request(app.getHttpServer())
      .post('/api/v1/talent/assessment/personal/start')
      .expect(201);

    const generatedSession =
      startResponse.body.data?.session ?? startResponse.body.session;

    profileStore.personal_assessment_answers = {
      ...section1Answers(),
      claimed_level: 'mid',
      _meta: { generatedSession },
    };

    await request(app.getHttpServer())
      .post('/api/v1/talent/assessment/personal/complete')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('success');
        expect(res.body.completedAt).toBeDefined();
      });
  });

  it('POST /api/v1/talent/assessment/personal/complete rejects when the generated session is missing', async () => {
    profileStore.personal_assessment_answers = {
      claimed_level: 'mid',
    };
    MockJwtAuthGuard.nextUser = {
      sub: talentUser.id,
      email: talentUser.email,
      role: UserRole.TALENT,
      onboarding_complete: true,
    };

    await request(app.getHttpServer())
      .post('/api/v1/talent/assessment/personal/complete')
      .expect(422)
      .expect((res) => {
        expect(res.body.message).toBe(
          'Generate a personal assessment session before submitting answers',
        );
      });
  });

  it('POST /api/v1/talent/assessment/personal/complete rejects when onboarding fields are missing', async () => {
    profileStore.region = null;
    MockJwtAuthGuard.nextUser = {
      sub: talentUser.id,
      email: talentUser.email,
      role: UserRole.TALENT,
      onboarding_complete: true,
    };

    await request(app.getHttpServer())
      .post('/api/v1/talent/assessment/personal/complete')
      .expect(422)
      .expect((res) => {
        expect(res.body.missingOnboardingFields).toEqual(
          expect.arrayContaining(['region']),
        );
      });
  });

  it('POST /api/v1/talent/assessment/personal/section/1 rejects employers', async () => {
    MockJwtAuthGuard.nextUser = {
      sub: employerUser.id,
      email: employerUser.email,
      role: UserRole.EMPLOYER,
      onboarding_complete: true,
    };

    await request(app.getHttpServer())
      .post('/api/v1/talent/assessment/personal/section/1')
      .send({ answers: section1Answers() })
      .expect(403);
  });
});
