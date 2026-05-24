import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AssessmentAttempt,
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentResult,
  AssessmentType,
  QuestionType,
  TalentQuestionHistory,
  VerifiedLevel,
} from '../../assessments/entities';
import { TalentProfile } from '../entities/talent-profile.entity';
import { ErrorMessages } from '../../../shared';
import { SKILL_ASSESSMENT_MAX_ATTEMPTS, SKILL_ASSESSMENT_SESSION_TIMEOUT_MS } from '../talent.constants';
import {
  ASSESSMENT_LONG_TEXT_MAX_CHARS,
  ASSESSMENT_LONG_TEXT_MIN_CHARS,
} from './assessment-answer-blocks.constants';
import { SkillAssessmentService } from './skill-assessment.service';
import { makeTalentProfile } from './personal-assessment.test-fixtures';
import { IntegrityEventType } from './dto/integrity-event.dto';

describe('SkillAssessmentService', () => {
  let service: SkillAssessmentService;

  let talentProfileRepo: {
    findOne: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let attemptRepo: {
    count: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let questionRepo: Record<string, jest.Mock>;
  let rubricScoring: { scoreAnswers: jest.Mock };
  let eligibleSkillQuestions: AssessmentQuestion[];

  const userId = 'talent-user-1';
  let profile = makeTalentProfile({
    personal_assessment_completed_at: new Date(),
    claimed_level: 'mid' as never,
    track: 'frontend_developer',
    advanced_assessment_completed_at: null,
  });

  function mockTransaction(probeQuestions: AssessmentQuestion[] = []) {
    let eligibleQueryCount = 0;
    talentProfileRepo.manager.transaction.mockImplementation(
      async (work: (manager: EntityManagerLike) => Promise<unknown>) => {
        const manager: EntityManagerLike = {
          findOne: jest.fn().mockResolvedValue(profile),
          getRepository: jest.fn(() => attemptRepo),
          createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockImplementation(() => {
              eligibleQueryCount += 1;
              if (eligibleQueryCount === 1) {
                return eligibleSkillQuestions;
              }
              return probeQuestions;
            }),
          })),
          create: jest.fn(
            (
              _entity: typeof AssessmentAttempt | typeof AssessmentResult,
              data: Partial<AssessmentAttempt | AssessmentResult>,
            ) => attemptRepo.create(data),
          ),
          save: jest.fn(
            (
              _entity:
                | typeof AssessmentAttempt
                | typeof AssessmentResponse
                | typeof TalentQuestionHistory
                | typeof AssessmentResult,
              data: AssessmentAttempt | unknown[],
            ) => attemptRepo.save(data),
          ),
          update: jest.fn(),
        };
        return work(manager);
      },
    );
  }

  beforeEach(() => {
    profile = makeTalentProfile({
      personal_assessment_completed_at: new Date(),
      claimed_level: 'mid' as never,
      track: 'frontend_developer',
      advanced_assessment_completed_at: null,
    });

    attemptRepo = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => Object.assign(new AssessmentAttempt(), data)),
      save: jest.fn(async (data) =>
        Object.assign(new AssessmentAttempt(), data, { id: 'attempt-1' }),
      ),
      update: jest.fn().mockResolvedValue(undefined),
    };

    questionRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => data),
      findBy: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: '0' }),
      })),
    };
    eligibleSkillQuestions = makeSkillBankQuestions();

    talentProfileRepo = {
      findOne: jest.fn().mockResolvedValue(profile),
      manager: { transaction: jest.fn() },
    };

    mockTransaction();

    rubricScoring = { scoreAnswers: jest.fn().mockResolvedValue([]) };

    service = new SkillAssessmentService(
      talentProfileRepo as never,
      questionRepo as never,
      attemptRepo as never,
      {} as never,
      {} as never,
      {} as never,
      rubricScoring as never,
      { generate: jest.fn() } as never,
      { generateQuestions: jest.fn().mockResolvedValue([]) } as never,
    );
  });

  it(`blocks start when ${SKILL_ASSESSMENT_MAX_ATTEMPTS} skill attempts are already completed`, async () => {
    attemptRepo.count.mockResolvedValue(SKILL_ASSESSMENT_MAX_ATTEMPTS);

    await expect(service.start(userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.start(userId)).rejects.toMatchObject({
      message: ErrorMessages.SKILL_ASSESSMENT.MAX_ATTEMPTS_REACHED,
    });
    expect(attemptRepo.save).not.toHaveBeenCalled();
  });

  it('blocks start when an active skill session already exists under lock', async () => {
    attemptRepo.count.mockResolvedValue(2);
    attemptRepo.findOne.mockResolvedValue(
      Object.assign(new AssessmentAttempt(), { id: 'active-attempt' }),
    );

    await expect(service.start(userId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.start(userId)).rejects.toMatchObject({
      response: expect.objectContaining({
        existing_session_id: 'active-attempt',
      }),
    });
    expect(attemptRepo.save).not.toHaveBeenCalled();
  });

  it('auto-abandons a stale session and allows a new start', async () => {
    const staleStartedAt = new Date(
      Date.now() - SKILL_ASSESSMENT_SESSION_TIMEOUT_MS - 1000,
    );
    attemptRepo.count.mockResolvedValue(0);
    attemptRepo.findOne.mockResolvedValue(
      Object.assign(new AssessmentAttempt(), {
        id: 'stale-attempt',
        started_at: staleStartedAt,
      }),
    );

    const result = await service.start(userId);

    expect(attemptRepo.update).toHaveBeenCalledWith('stale-attempt', {
      completed_at: expect.any(Date),
      force_submitted: true,
    });
    expect(result.session_id).toBe('attempt-1');
  });

  it('returns session_id and attempt_number when starting a skill assessment', async () => {
    const result = await service.start(userId);

    expect(result.session_id).toBe('attempt-1');
    expect(result.attempt_number).toBe(1);
    expect(result).not.toHaveProperty('attempt_id');
    expect(result.questions).toHaveLength(10);
    expect(result.questions[0].block).toBe('mcq');
    expect(result.questions[6].block).toBe('long_text');
    expect(attemptRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        generated_questions_json: expect.objectContaining({
          context: expect.objectContaining({
            attempt_number: 1,
          }),
        }),
      }),
    );
    expect(attemptRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          question_id: 'skill-mcq-1',
          user_answer: { served: true },
        }),
      ]),
    );
  });

  it('returns attempt_number 3 when two skill attempts are already completed', async () => {
    attemptRepo.count.mockResolvedValue(2);

    const result = await service.start(userId);

    expect(result.attempt_number).toBe(3);
  });

  it('refuses to start when the unseen bank lacks the skill question mix', async () => {
    eligibleSkillQuestions = makeSkillBankQuestions().slice(0, 9);

    await expect(service.start(userId)).rejects.toMatchObject({
      message: ErrorMessages.SKILL_ASSESSMENT.NO_QUESTIONS_AVAILABLE,
    });
    expect(attemptRepo.save).not.toHaveBeenCalled();
  });

  it('scopes history exclusion to last attempt ID when a prior attempt exists', async () => {
    const lastAttempt = Object.assign(new AssessmentAttempt(), {
      id: 'prev-attempt-1',
      completed_at: new Date('2026-05-20T10:00:00.000Z'),
    });
    attemptRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(lastAttempt);

    let andWhereCallArgs: unknown[] = [];
    talentProfileRepo.manager.transaction.mockImplementation(
      async (work: (manager: EntityManagerLike) => Promise<unknown>) => {
        const andWhereMock = jest.fn().mockReturnThis();
        const manager: EntityManagerLike = {
          findOne: jest.fn().mockResolvedValue(profile),
          getRepository: jest.fn(() => attemptRepo),
          createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: andWhereMock,
            orderBy: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue(eligibleSkillQuestions),
          })),
          create: jest.fn((_entity: unknown, data: unknown) =>
            attemptRepo.create(data),
          ),
          save: jest.fn((_entity: unknown, data: unknown) =>
            attemptRepo.save(data),
          ),
          update: jest.fn(),
        };
        const result = await work(manager);
        andWhereCallArgs = andWhereMock.mock.calls.map((call) => call[1]);
        return result;
      },
    );

    await service.start(userId);

    const historyFilter = andWhereCallArgs.find(
      (args): args is Record<string, unknown> =>
        args !== null &&
        typeof args === 'object' &&
        'lastAttemptId' in (args as Record<string, unknown>),
    );

    expect(historyFilter).toBeDefined();
    expect(historyFilter!.lastAttemptId).toBe('prev-attempt-1');
  });

  it('omits history filter when no previous completed attempt exists', async () => {
    attemptRepo.findOne.mockResolvedValue(null);

    let andWhereCallArgs: unknown[] = [];
    talentProfileRepo.manager.transaction.mockImplementation(
      async (work: (manager: EntityManagerLike) => Promise<unknown>) => {
        const andWhereMock = jest.fn().mockReturnThis();
        const manager: EntityManagerLike = {
          findOne: jest.fn().mockResolvedValue(profile),
          getRepository: jest.fn(() => attemptRepo),
          createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: andWhereMock,
            orderBy: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue(eligibleSkillQuestions),
          })),
          create: jest.fn((_entity: unknown, data: unknown) =>
            attemptRepo.create(data),
          ),
          save: jest.fn((_entity: unknown, data: unknown) =>
            attemptRepo.save(data),
          ),
          update: jest.fn(),
        };
        const result = await work(manager);
        andWhereCallArgs = andWhereMock.mock.calls.map((call) => call[1]);
        return result;
      },
    );

    await service.start(userId);

    const historyFilter = andWhereCallArgs.find(
      (args) =>
        args !== null &&
        typeof args === 'object' &&
        'lastAttemptId' in (args as Record<string, unknown>),
    );

    expect(historyFilter).toBeUndefined();
  });

  it('starts a retake session successfully when history is scoped to the last attempt', async () => {
    const lastAttempt = Object.assign(new AssessmentAttempt(), {
      id: 'prev-attempt-1',
      completed_at: new Date('2026-05-20T10:00:00.000Z'),
    });
    attemptRepo.count.mockResolvedValue(1);
    attemptRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(lastAttempt);

    const result = await service.start(userId);

    expect(result.session_id).toBe('attempt-1');
    expect(result.questions).toHaveLength(10);
  });

  it('returns a stored skill session without exposing correct answers or side effects', async () => {
    const attempt = Object.assign(new AssessmentAttempt(), {
      id: 'attempt-1',
      talent_profile_id: profile.id,
      assessment_type: AssessmentType.SKILL,
      started_at: new Date('2026-05-21T10:00:00.000Z'),
      completed_at: null,
      generated_questions_json: {
        context: { verified_level: VerifiedLevel.MID },
        questions: [
          {
            question_id: 'question-1',
            question_number: 1,
            question_type: QuestionType.SINGLE_PICK,
            question_text: 'Which metric best indicates activation?',
            options: ['Signups', 'First key action', 'Page views'],
            correct_answer: 'First key action',
          },
        ],
      },
    });
    attemptRepo.findOne.mockResolvedValue(attempt);

    const first = await service.getSession(userId, attempt.id);
    const second = await service.getSession(userId, attempt.id);

    expect(first).toEqual(second);
    expect(first).toEqual({
      status: 'success',
      message: 'Skill assessment session returned',
      attempt_id: 'attempt-1',
      session_id: 'attempt-1',
      attempt_number: 1,
      started_at: '2026-05-21T10:00:00.000Z',
      verified_level: VerifiedLevel.MID,
      questions: [
        {
          question_id: 'question-1',
          question_number: 1,
          block: 'mcq',
          question_type: QuestionType.SINGLE_PICK,
          question_text: 'Which metric best indicates activation?',
          options: ['Signups', 'First key action', 'Page views'],
        },
      ],
    });
    expect(first.questions[0]).not.toHaveProperty('correct_answer');
    expect(attemptRepo.save).not.toHaveBeenCalled();
  });

  it('throws 404 when skill session does not exist for the talent', async () => {
    attemptRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getSession(userId, 'missing-attempt'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws 400 when stored skill session has no questions', async () => {
    attemptRepo.findOne.mockResolvedValue(
      Object.assign(new AssessmentAttempt(), {
        id: 'attempt-1',
        talent_profile_id: profile.id,
        assessment_type: AssessmentType.SKILL,
        started_at: new Date('2026-05-21T10:00:00.000Z'),
        generated_questions_json: {
          context: { verified_level: VerifiedLevel.MID },
          questions: [],
        },
      }),
    );

    await expect(
      service.getSession(userId, 'attempt-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns session_id when submitting a skill assessment', async () => {
    const attempt = Object.assign(new AssessmentAttempt(), {
      id: 'attempt-1',
      talent_profile_id: profile.id,
      assessment_type: AssessmentType.SKILL,
      started_at: new Date('2026-05-21T10:00:00.000Z'),
      completed_at: null,
      generated_questions_json: {
        context: { verified_level: VerifiedLevel.MID },
        questions: [
          {
            question_id: 'question-1',
            question_number: 1,
            question_type: QuestionType.SINGLE_PICK,
            question_text: 'Which metric best indicates activation?',
            options: ['Signups', 'First key action', 'Page views'],
            correct_answer: 'First key action',
          },
        ],
      },
    });
    attemptRepo.findOne.mockResolvedValue(attempt);
    questionRepo.findBy.mockResolvedValue([
      Object.assign(new AssessmentQuestion(), {
        id: 'question-1',
        competency: 'activation',
        metadata: {},
      }),
    ]);

    const result = await service.submit(userId, {
      attempt_id: 'attempt-1',
      answers: [{ question_id: 'question-1', answer: 'First key action' }],
    });

    expect(result.session_id).toBe('attempt-1');
    expect(result.attempt_number).toBe(1);
    expect(result).not.toHaveProperty('attempt_id');
  });

  it('does not pass or keep claimed level when primary MCQs are wrong even with high text scores', async () => {
    const validTextAnswer =
      'I would clarify the expected outcome, inspect the available evidence, isolate the most likely cause, and communicate tradeoffs clearly before choosing the next step.';
    const attempt = Object.assign(new AssessmentAttempt(), {
      id: 'attempt-1',
      talent_profile_id: profile.id,
      assessment_type: AssessmentType.SKILL,
      started_at: new Date('2026-05-21T10:00:00.000Z'),
      completed_at: null,
      generated_questions_json: {
        context: { verified_level: VerifiedLevel.MID },
        questions: [
          {
            question_id: 'question-mcq-1',
            question_number: 1,
            block: 'mcq',
            question_type: QuestionType.SINGLE_PICK,
            question_text: 'Which metric best indicates activation?',
            options: ['Signups', 'First key action', 'Page views'],
            correct_answer: 'First key action',
          },
          {
            question_id: 'question-text-1',
            question_number: 2,
            block: 'long_text',
            question_type: QuestionType.REQUIRED_TEXT,
            question_text: 'Describe your approach.',
            options: null,
            correct_answer: null,
          },
        ],
      },
    });
    attemptRepo.findOne.mockResolvedValue(attempt);
    questionRepo.findBy.mockResolvedValue([
      Object.assign(new AssessmentQuestion(), {
        id: 'question-mcq-1',
        metadata: {},
      }),
      Object.assign(new AssessmentQuestion(), {
        id: 'question-text-1',
        metadata: {},
      }),
    ]);
    rubricScoring.scoreAnswers.mockResolvedValue([
      {
        question_id: 'question-text-1',
        rubric: {
          relevance: 3,
          reasoning: 3,
          specificity: 3,
          completeness: 3,
          total: 12,
          feedback: 'Strong.',
        },
        raw_score: 12,
        max_score: 12,
      },
    ]);

    const result = await service.submit(userId, {
      attempt_id: 'attempt-1',
      answers: [
        { question_id: 'question-mcq-1', answer: 'Signups' },
        { question_id: 'question-text-1', answer: validTextAnswer },
      ],
    });

    expect(result.percentage).toBeLessThan(70);
    expect(result.passed).toBe(false);
    expect(result.validated_level).toBe(VerifiedLevel.JUNIOR);
  });

  it('rejects skill text answers outside the allowed length range', async () => {
    const attempt = Object.assign(new AssessmentAttempt(), {
      id: 'attempt-1',
      talent_profile_id: profile.id,
      assessment_type: AssessmentType.SKILL,
      started_at: new Date('2026-05-21T10:00:00.000Z'),
      completed_at: null,
      generated_questions_json: {
        context: { verified_level: VerifiedLevel.MID },
        questions: [
          {
            question_id: 'question-text-1',
            question_number: 7,
            block: 'long_text',
            question_type: QuestionType.REQUIRED_TEXT,
            question_text: 'Describe your approach.',
            options: null,
            correct_answer: null,
          },
        ],
      },
    });
    attemptRepo.findOne.mockResolvedValue(attempt);
    questionRepo.findBy.mockResolvedValue([
      Object.assign(new AssessmentQuestion(), {
        id: 'question-text-1',
        metadata: {},
      }),
    ]);

    await expect(
      service.submit(userId, {
        attempt_id: 'attempt-1',
        answers: [{ question_id: 'question-text-1', answer: 'Too short' }],
      }),
    ).rejects.toMatchObject({
      message: `Question 7 must be between ${ASSESSMENT_LONG_TEXT_MIN_CHARS} and ${ASSESSMENT_LONG_TEXT_MAX_CHARS} characters`,
    });
  });

  it('resolves Stage 2 confirmed-level outcomes from claimed-level score', () => {
    const resolveLevel = (
      service as unknown as {
        resolveValidatedLevel: (
          claimedPercentage: number,
          aboveLevelPercentage: number,
          belowLevelPercentage: number,
          overallPercentage: number,
          claimedLevel: VerifiedLevel,
          primaryMcqGatePassed?: boolean,
          aboveProbeMcqGatePassed?: boolean,
        ) => VerifiedLevel;
      }
    ).resolveValidatedLevel.bind(service);

    expect(resolveLevel(70, 0, 0, 70, VerifiedLevel.MID)).toBe(
      VerifiedLevel.MID,
    );
    expect(resolveLevel(59, 0, 65, 60, VerifiedLevel.SENIOR)).toBe(
      VerifiedLevel.MID,
    );
    expect(resolveLevel(59, 0, 50, 58, VerifiedLevel.SENIOR)).toBe(
      VerifiedLevel.MID,
    );
    expect(resolveLevel(54, 0, 0, 54, VerifiedLevel.EXPERT)).toBe(
      VerifiedLevel.JUNIOR,
    );
    expect(resolveLevel(54, 0, 0, 54, VerifiedLevel.JUNIOR)).toBe(
      VerifiedLevel.JUNIOR,
    );
    expect(resolveLevel(95, 70, 0, 92, VerifiedLevel.MID)).toBe(
      VerifiedLevel.SENIOR,
    );
    expect(
      resolveLevel(95, 70, 0, 92, VerifiedLevel.MID, true, false),
    ).toBe(VerifiedLevel.MID);
    expect(
      resolveLevel(70, 0, 0, 70, VerifiedLevel.MID, false, true),
    ).toBe(VerifiedLevel.JUNIOR);
    expect(resolveLevel(95, 50, 0, 90, VerifiedLevel.MID)).toBe(
      VerifiedLevel.MID,
    );
    expect(resolveLevel(65, 0, 0, 65, VerifiedLevel.MID)).toBe(
      VerifiedLevel.JUNIOR,
    );
  });

  it('does not enforce attempt limit after advanced assessment is complete', async () => {
    profile.advanced_assessment_completed_at = new Date();
    attemptRepo.count.mockResolvedValue(SKILL_ASSESSMENT_MAX_ATTEMPTS);

    await expect(
      (
        service as unknown as {
          assertSkillAssessmentAttemptsRemaining: (
            p: TalentProfile,
          ) => Promise<void>;
        }
      ).assertSkillAssessmentAttemptsRemaining(profile),
    ).resolves.toBeUndefined();

    expect(attemptRepo.count).not.toHaveBeenCalled();
  });

  describe('flag()', () => {
    it('voids an active skill session and returns logout action', async () => {
      const attempt = Object.assign(new AssessmentAttempt(), {
        id: 'attempt-1',
        talent_profile_id: profile.id,
        assessment_type: AssessmentType.SKILL,
        completed_at: null,
        force_submitted: false,
        tab_switch_count: 0,
        copy_paste_count: 0,
      });

      talentProfileRepo.manager.transaction.mockImplementation(
        async (
          work: (manager: Record<string, jest.Mock>) => Promise<unknown>,
        ) =>
          work({
            findOne: jest
              .fn()
              .mockResolvedValueOnce(attempt)
              .mockResolvedValueOnce({
                ...attempt,
                tab_switch_count: 1,
                copy_paste_count: 0,
              }),
            increment: jest.fn().mockResolvedValue(undefined),
            update: jest.fn().mockResolvedValue(undefined),
          }),
      );

      const result = await service.flag(userId, 'attempt-1', {
        event_type: IntegrityEventType.TAB_SWITCH,
      });

      expect(result.status).toBe('voided');
      expect(result.action).toBe('logout');
      expect(result.session_voided).toBe(true);
      expect(result.tab_switch_count).toBe(1);
    });

    it('throws 400 when flagging a completed skill session', async () => {
      talentProfileRepo.manager.transaction.mockImplementation(
        async (
          work: (manager: Record<string, jest.Mock>) => Promise<unknown>,
        ) =>
          work({
            findOne: jest.fn().mockResolvedValue(
              Object.assign(new AssessmentAttempt(), {
                id: 'attempt-1',
                completed_at: new Date(),
              }),
            ),
          }),
      );

      await expect(
        service.flag(userId, 'attempt-1', {
          event_type: IntegrityEventType.COPY_PASTE,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

type EntityManagerLike = {
  findOne: jest.Mock;
  getRepository: jest.Mock;
  createQueryBuilder: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
};

function makeSkillBankQuestions(): AssessmentQuestion[] {
  return [
    ...Array.from({ length: 6 }, (_ignored, index) =>
      Object.assign(new AssessmentQuestion(), {
        id: `skill-mcq-${index + 1}`,
        question_type: QuestionType.SINGLE_PICK,
        question_text: `Skill MCQ ${index + 1}`,
        options: ['A', 'B'],
        correct_answer: 'A',
      }),
    ),
    ...Array.from({ length: 4 }, (_ignored, index) =>
      Object.assign(new AssessmentQuestion(), {
        id: `skill-text-${index + 1}`,
        question_type: QuestionType.REQUIRED_TEXT,
        question_text: `Skill text ${index + 1}`,
        options: null,
        correct_answer: null,
      }),
    ),
  ];
}
