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
import { SKILL_ASSESSMENT_MAX_ATTEMPTS } from '../talent.constants';
import { SkillAssessmentService } from './skill-assessment.service';
import { makeTalentProfile } from './personal-assessment.test-fixtures';

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

  function mockTransaction() {
    talentProfileRepo.manager.transaction.mockImplementation(
      async (work: (manager: EntityManagerLike) => Promise<unknown>) => {
        const manager: EntityManagerLike = {
          findOne: jest.fn().mockResolvedValue(profile),
          getRepository: jest.fn(() => attemptRepo),
          createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue(eligibleSkillQuestions),
          })),
          create: jest.fn(
            (
              _entity:
                | typeof AssessmentAttempt
                | typeof AssessmentResult,
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
            ) =>
              attemptRepo.save(data),
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
    await expect(attemptRepo.save).not.toHaveBeenCalled();
  });

  it('returns session_id, not attempt_id, when starting a skill assessment', async () => {
    const result = await service.start(userId);

    expect(result.session_id).toBe('attempt-1');
    expect(result).not.toHaveProperty('attempt_id');
    expect(result.questions).toHaveLength(10);
    expect(attemptRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          question_id: 'skill-mcq-1',
          user_answer: { served: true },
        }),
      ]),
    );
  });

  it('refuses to start when the unseen bank lacks the skill question mix', async () => {
    eligibleSkillQuestions = makeSkillBankQuestions().slice(0, 9);

    await expect(service.start(userId)).rejects.toMatchObject({
      message: ErrorMessages.SKILL_ASSESSMENT.NO_QUESTIONS_AVAILABLE,
    });
    expect(attemptRepo.save).not.toHaveBeenCalled();
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
      started_at: '2026-05-21T10:00:00.000Z',
      verified_level: VerifiedLevel.MID,
      questions: [
        {
          question_id: 'question-1',
          question_number: 1,
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

    await expect(service.getSession(userId, 'missing-attempt')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws 400 when stored skill session has no questions', async () => {
    attemptRepo.findOne.mockResolvedValue(
      Object.assign(new AssessmentAttempt(), {
        id: 'attempt-1',
        talent_profile_id: profile.id,
        assessment_type: AssessmentType.SKILL,
        started_at: new Date('2026-05-21T10:00:00.000Z'),
        generated_questions_json: { context: { verified_level: VerifiedLevel.MID }, questions: [] },
      }),
    );

    await expect(service.getSession(userId, 'attempt-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
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
    expect(result).not.toHaveProperty('attempt_id');
  });

  it('resolves Stage 2 confirmed-level outcomes from claimed-level score', () => {
    const resolveLevel = (
      service as unknown as {
        resolveValidatedLevel: (
          percentage: number,
          claimedLevel: VerifiedLevel,
        ) => VerifiedLevel;
      }
    ).resolveValidatedLevel.bind(service);

    expect(resolveLevel(70, VerifiedLevel.MID)).toBe(VerifiedLevel.MID);
    expect(resolveLevel(59, VerifiedLevel.SENIOR)).toBe(VerifiedLevel.MID);
    expect(resolveLevel(54, VerifiedLevel.EXPERT)).toBe(VerifiedLevel.JUNIOR);
    expect(resolveLevel(54, VerifiedLevel.ENTRY)).toBe(VerifiedLevel.ENTRY);
    expect(resolveLevel(100, VerifiedLevel.MID)).toBe(VerifiedLevel.MID);
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
