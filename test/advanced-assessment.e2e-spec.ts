import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestModule,
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
import { PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { CaseTransformMiddleware } from '../src/common/middleware/case-transform.middleware';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AdvancedAssessmentController } from '../src/modules/talent/assessment/advanced-assessment.controller';
import { AdvancedAssessmentService } from '../src/modules/talent/assessment/advanced-assessment.service';
import { AdvancedAssessmentQueueService } from '../src/modules/talent/assessment/advanced-assessment-queue.service';
import { AdvancedAssessmentSubmitProcessor } from '../src/modules/talent/assessment/advanced-assessment-submit.processor';
import { AdvancedAssessmentAiService } from '../src/modules/talent/assessment/advanced-assessment-ai.service';
import { EmployerPoolProfileService } from '../src/modules/talent/assessment/employer-pool-profile.service';
import { PersonalAssessmentService } from '../src/modules/talent/assessment/personal-assessment.service';
import { RubricScoringService } from '../src/modules/ai/rubric-scoring.service';
import { GuidanceReportService } from '../src/modules/ai/guidance-report.service';
import {
  makeTalentProfile,
  makeTalentUser,
} from '../src/modules/talent/assessment/personal-assessment.test-fixtures';
import {
  AssessmentAttempt,
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentResult,
  AssessmentType,
  QuestionType,
  SlotType,
  TalentQuestionHistory,
} from '../src/modules/assessments/entities';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../src/modules/talent/entities/talent-profile.entity';
import { EmployerPoolProfile } from '../src/modules/talent/entities/employer-pool-profile.entity';
import { VerifiedLevel } from '../src/modules/assessments/entities/assessment-question.entity';
import { AssessmentTier } from '../src/modules/assessments/entities/assessment-result.entity';
import { QuestionGenerationService } from '../src/modules/ai/question-generation.service';
import { MailService } from '../src/modules/mail/mail.service';
import { BankExhaustedAlertService } from '../src/modules/mail/bank-exhausted-alert.service';
import { NotificationDispatchService } from '../src/modules/notifications/notification-dispatch.service';
import { UserRole } from '../src/modules/users/entities/user.entity';
import { UsersService } from '../src/modules/users/users.service';

// ── Mock guard ────────────────────────────────────────────────────────────────

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

@Module({})
class TestCaseTransformModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CaseTransformMiddleware).forRoutes('*');
  }
}

// ── Session fixture ───────────────────────────────────────────────────────────

// Deterministic UUIDs for test questions
const MCQ_IDS = Array.from(
  { length: 15 },
  (_, i) => `c${String(i + 1).padStart(7, '0')}-0000-4000-a000-000000000001`,
);
const SHORT_IDS = Array.from(
  { length: 5 },
  (_, i) => `d${String(i + 1).padStart(7, '0')}-0000-4000-a000-000000000002`,
);
const LONG_IDS = Array.from(
  { length: 5 },
  (_, i) => `e${String(i + 1).padStart(7, '0')}-0000-4000-a000-000000000003`,
);
const SHORT_ANSWER =
  'I would clarify the goal, compare options with evidence, and communicate the tradeoffs before choosing a practical next step.';
const LONG_ANSWER =
  'I would start by confirming the business goal, user need, and operational constraints so the team solves the right problem. Then I would compare options, identify the highest-risk assumptions, and explain the tradeoffs clearly to stakeholders before deciding on a path. After execution, I would review the outcome against the original goal and document what I would change next time.';

function makeSessionJson() {
  const mcq = MCQ_IDS.map((id, i) => ({
    question_id: id,
    question_number: i + 1,
    block: 'mcq',
    question_type: QuestionType.SINGLE_PICK,
    question_text: `MCQ ${i + 1}`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    slot_type: null,
    metadata: null,
    correct_answer: i < 10 ? 'Option A' : 'Option B',
  }));

  const shortText = SHORT_IDS.map((id, i) => ({
    question_id: id,
    question_number: 16 + i,
    block: 'short_text',
    question_type: QuestionType.REQUIRED_TEXT,
    question_text: `Short text ${i + 1}`,
    options: null,
    slot_type: null,
    metadata: null,
  }));

  const longText = LONG_IDS.map((id, i) => ({
    question_id: id,
    question_number: 21 + i,
    block: 'long_text',
    question_type: QuestionType.REQUIRED_TEXT,
    question_text: `Long text ${i + 1}`,
    options: null,
    slot_type: i < 2 ? SlotType.SITUATIONAL : SlotType.WORK_TASK,
    metadata: null,
  }));

  return {
    context: { verified_level: VerifiedLevel.MID },
    questions: [...mcq, ...shortText, ...longText],
  };
}

const ATTEMPT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PROFILE_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

function makeActiveAttempt(
  overrides: Partial<AssessmentAttempt> = {},
): AssessmentAttempt {
  return Object.assign(new AssessmentAttempt(), {
    id: ATTEMPT_ID,
    talent_profile_id: PROFILE_ID,
    assessment_type: AssessmentType.ADVANCED,
    started_at: new Date(),
    completed_at: null,
    expires_at: new Date(Date.now() + 25 * 60 * 1000),
    tab_switch_count: 0,
    copy_paste_count: 0,
    force_submitted: false,
    generated_questions_json: makeSessionJson(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });
}

function submitBody() {
  const session = makeSessionJson();
  return {
    session_id: ATTEMPT_ID,
    answers: session.questions.map((q) => ({
      questionId: q.question_id,
      answer:
        q.block === 'mcq'
          ? 'Option A'
          : q.block === 'short_text'
            ? SHORT_ANSWER
            : LONG_ANSWER,
      timeSpentSeconds: 20,
    })),
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Advanced assessment (e2e)', () => {
  let app: INestApplication<App>;
  let submitQueue: AdvancedAssessmentQueueService;

  const talentUser = makeTalentUser();
  const employerUser = makeTalentUser({
    id: 'employer-1',
    role: UserRole.EMPLOYER,
  });

  let profileStore: TalentProfile;
  let attemptStore: AssessmentAttempt;

  beforeEach(async () => {
    profileStore = makeTalentProfile({
      id: PROFILE_ID,
      validated_level: VerifiedLevel.MID,
      assessment_locked_until: null,
      status: TalentProfileStatus.IN_PROGRESS,
    });
    attemptStore = makeActiveAttempt();

    MockJwtAuthGuard.nextUser = {
      sub: talentUser.id,
      email: talentUser.email,
      role: UserRole.TALENT,
      onboarding_complete: true,
    };

    const entityManager = {
      findOne: jest.fn().mockImplementation((entity: unknown) => {
        if (entity === AssessmentAttempt) {
          return Promise.resolve(attemptStore);
        }
        if (entity === TalentProfile) {
          return Promise.resolve(profileStore);
        }
        return Promise.resolve(null);
      }),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      })),
      increment: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest
        .fn()
        .mockImplementation((_e: unknown, d: unknown) => Promise.resolve(d)),
      create: jest.fn().mockImplementation((_e: unknown, d: unknown) => d),
      update: jest
        .fn()
        .mockImplementation(
          (
            entity: unknown,
            _criteria: Record<string, unknown>,
            patch: Partial<AssessmentAttempt> | Partial<TalentProfile>,
          ) => {
            if (entity === AssessmentAttempt) {
              attemptStore = Object.assign(attemptStore, patch);
            } else if (entity === TalentProfile) {
              profileStore = Object.assign(profileStore, patch);
            }
            return Promise.resolve({ affected: 1 });
          },
        ),
    };

    const talentProfileRepoMock = {
      findOne: jest.fn().mockResolvedValue(profileStore),
      update: jest.fn().mockResolvedValue(undefined),
      manager: {
        transaction: jest
          .fn()
          .mockImplementation(
            (work: (em: typeof entityManager) => Promise<unknown>) =>
              work(entityManager),
          ),
      },
    };

    const attemptRepoMock = {
      findOne: jest
        .fn()
        .mockImplementation(() => Promise.resolve(attemptStore)),
      save: jest.fn().mockImplementation((a: AssessmentAttempt) => {
        attemptStore = a;
        return Promise.resolve(a);
      }),
      increment: jest
        .fn()
        .mockImplementation(
          (
            _criteria: Record<string, unknown>,
            field: string,
            value: number,
          ) => {
            if (field === 'tab_switch_count') {
              attemptStore.tab_switch_count += value;
            } else if (field === 'copy_paste_count') {
              attemptStore.copy_paste_count += value;
            }
            return Promise.resolve({ affected: 1 });
          },
        ),
      update: jest
        .fn()
        .mockImplementation(
          (
            _criteria: Record<string, unknown>,
            patch: Partial<AssessmentAttempt>,
          ) => {
            attemptStore = Object.assign(attemptStore, patch);
            return Promise.resolve({ affected: 1 });
          },
        ),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestCaseTransformModule],
      controllers: [AdvancedAssessmentController],
      providers: [
        AdvancedAssessmentService,
        AdvancedAssessmentSubmitProcessor,
        AdvancedAssessmentQueueService,
        AdvancedAssessmentAiService,
        {
          provide: getRepositoryToken(TalentProfile),
          useValue: talentProfileRepoMock,
        },
        {
          provide: getRepositoryToken(AssessmentQuestion),
          useValue: { find: jest.fn(), findBy: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(AssessmentAttempt),
          useValue: attemptRepoMock,
        },
        {
          provide: getRepositoryToken(AssessmentResponse),
          useValue: { save: jest.fn() },
        },
        {
          provide: getRepositoryToken(AssessmentResult),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest
              .fn()
              .mockImplementation((r: Partial<AssessmentResult>) =>
                Promise.resolve({ ...r, id: 'result-1' }),
              ),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: getRepositoryToken(TalentQuestionHistory),
          useValue: { save: jest.fn() },
        },
        {
          provide: getRepositoryToken(EmployerPoolProfile),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn(),
            create: jest.fn(),
            merge: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn().mockResolvedValue(talentUser),
          },
        },
        {
          provide: PersonalAssessmentService,
          useValue: {
            getAiContext: jest.fn().mockResolvedValue({
              track: 'frontend_developer',
              educationLevel: 'bachelor',
              region: 'Lagos',
              country: 'Nigeria',
              claimedLevel: VerifiedLevel.MID,
            }),
          },
        },
        {
          provide: RubricScoringService,
          useValue: {
            scoreAnswers: jest.fn().mockResolvedValue(
              Array.from({ length: 10 }, (_, i) => ({
                question_id: i < 5 ? SHORT_IDS[i] : LONG_IDS[i - 5],
                rubric: {
                  relevance: 2,
                  reasoning: 2,
                  specificity: 2,
                  completeness: 2,
                  total: 8,
                  feedback: 'Good.',
                },
                raw_score: 8,
                max_score: 12,
              })),
            ),
          },
        },
        {
          provide: GuidanceReportService,
          useValue: {
            generate: jest
              .fn()
              .mockImplementation(
                (input: Parameters<GuidanceReportService['generate']>[0]) =>
                  Promise.resolve({
                    report_type: input.report_type,
                    ai_summary:
                      'You demonstrate practical problem solving and clear product intuition. Your growth opportunities currently lie in testing and communication.',
                    growth_insight:
                      'Your recent assessments show steady progress in structured thinking. Focusing on testing and communication could improve your professional readiness.',
                    summary: 'Keep going.',
                    strength_ratings: [
                      { item: 'Clear practical problem solving.', rating: 3 },
                      { item: 'Good product intuition.', rating: 2 },
                      { item: 'Structured answer flow.', rating: 2 },
                    ],
                    weak_area_ratings: [
                      { item: 'Needs stronger testing habits.', rating: 2 },
                      { item: 'Improve technical communication.', rating: 1 },
                      { item: 'Build confidence under ambiguity.', rating: 1 },
                    ],
                    recommended_resources: [
                      {
                        title: 'NestJS Docs',
                        provider: 'NestJS',
                        url: 'https://docs.nestjs.com',
                        tier: 'free',
                        competency: 'Testing',
                        reason: 'Track-aligned practice material.',
                      },
                    ],
                    ...(input.report_type === 'emerging' && {
                      retake_advice:
                        'Review core concepts before the 14-day retake.',
                    }),
                    resource_page_url: '/resources',
                  }),
              ),
          },
        },
        {
          provide: EmployerPoolProfileService,
          useValue: { upsert: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: QuestionGenerationService,
          useValue: { generateQuestions: jest.fn() },
        },
        {
          provide: MailService,
          useValue: { sendAssessmentPerformance: jest.fn() },
        },
        {
          provide: BankExhaustedAlertService,
          useValue: { notify: jest.fn() },
        },
        {
          provide: NotificationDispatchService,
          useValue: { dispatch: jest.fn().mockResolvedValue(undefined) },
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        errorHttpStatusCode: 422,
      }),
    );
    await app.init();
    submitQueue = moduleFixture.get(AdvancedAssessmentQueueService);
    submitQueue.onModuleInit();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  // ── POST /advanced/submit ──────────────────────────────────────────────────

  describe('POST /api/v1/talent/assessment/advanced/submit', () => {
    it('returns 202 with processing status then completes the attempt in the background', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/talent/assessment/advanced/submit')
        .send(submitBody())
        .expect(202)
        .expect((res) => {
          expect(res.body.status).toBe('processing');
          expect(res.body.session_id ?? res.body.sessionId).toBe(ATTEMPT_ID);
          expect(res.body.score).toBeUndefined();
        });

      await submitQueue.awaitIdleForTests();
      expect(attemptStore.completed_at).toBeInstanceOf(Date);
    });

    it('returns 400 when attempt already submitted', async () => {
      attemptStore = makeActiveAttempt({ completed_at: new Date() });

      await request(app.getHttpServer())
        .post('/api/v1/talent/assessment/advanced/submit')
        .send(submitBody())
        .expect(400);
    });

    it('returns 400 when session was voided', async () => {
      attemptStore = makeActiveAttempt({ force_submitted: true });

      await request(app.getHttpServer())
        .post('/api/v1/talent/assessment/advanced/submit')
        .send(submitBody())
        .expect(400);
    });

    it('returns 422 when session_id is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/talent/assessment/advanced/submit')
        .send({ answers: [] })
        .expect(422);
    });

    it('returns 422 when answers array is empty', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/talent/assessment/advanced/submit')
        .send({ session_id: 'attempt-1', answers: [] })
        .expect(422);
    });

    it('accepts partial answers and still returns processing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/talent/assessment/advanced/submit')
        .send({
          session_id: ATTEMPT_ID,
          answers: [
            { questionId: MCQ_IDS[0], answer: 'Option A' },
            { questionId: SHORT_IDS[0], answer: SHORT_ANSWER },
            { questionId: LONG_IDS[0], answer: LONG_ANSWER },
          ],
        })
        .expect(202)
        .expect((res) => {
          expect(res.body.status).toBe('processing');
        });

      await submitQueue.awaitIdleForTests();
      expect(attemptStore.completed_at).toBeInstanceOf(Date);
    });

    it('returns 403 for employer role', async () => {
      MockJwtAuthGuard.nextUser = {
        sub: employerUser.id,
        email: employerUser.email,
        role: UserRole.EMPLOYER,
        onboarding_complete: true,
      };

      await request(app.getHttpServer())
        .post('/api/v1/talent/assessment/advanced/submit')
        .send(submitBody())
        .expect(403);
    });
  });

  // ── POST /session/:id/flag ─────────────────────────────────────────────────

  describe('POST /api/v1/talent/assessment/session/:id/flag', () => {
    it('voids session on tab switch', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/talent/assessment/session/${ATTEMPT_ID}/flag`)
        .send({ event_type: 'tab_switch' })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('voided');
          expect(res.body.action).toBe('logout');
          expect(res.body.sessionVoided).toBe(true);
          expect(res.body.tabSwitchCount).toBe(1);
        });
    });

    it('voids session on copy_paste event', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/talent/assessment/session/${ATTEMPT_ID}/flag`)
        .send({ event_type: 'copy_paste' })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('voided');
          expect(res.body.action).toBe('logout');
          expect(res.body.sessionVoided).toBe(true);
          expect(res.body.copyPasteCount).toBe(1);
        });
    });

    it('returns 400 when flagging an already completed session', async () => {
      attemptStore = makeActiveAttempt({ completed_at: new Date() });

      await request(app.getHttpServer())
        .post(`/api/v1/talent/assessment/session/${ATTEMPT_ID}/flag`)
        .send({ event_type: 'tab_switch' })
        .expect(400);
    });

    it('returns 422 for invalid event_type', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/talent/assessment/session/${ATTEMPT_ID}/flag`)
        .send({ event_type: 'invalid_event' })
        .expect(422);
    });

    it('returns 403 for employer role', async () => {
      MockJwtAuthGuard.nextUser = {
        sub: employerUser.id,
        email: employerUser.email,
        role: UserRole.EMPLOYER,
        onboarding_complete: true,
      };

      await request(app.getHttpServer())
        .post(`/api/v1/talent/assessment/session/${ATTEMPT_ID}/flag`)
        .send({ event_type: 'tab_switch' })
        .expect(403);
    });
  });
});
