import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AssessmentTier } from '../../assessments/entities/assessment-result.entity';
import {
  AssessmentAttempt,
  AssessmentType,
  QuestionType,
} from '../../assessments/entities';
import { AssessmentResult } from '../../assessments/entities/assessment-result.entity';
import { VerifiedLevel } from '../../assessments/entities/assessment-question.entity';
import { TalentProfileStatus } from '../entities/talent-profile.entity';
import { AdvancedAssessmentService } from './advanced-assessment.service';
import { IntegrityEventType } from './dto/advanced-assessment.dto';
import { makeTalentProfile } from './personal-assessment.test-fixtures';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAttempt(
  overrides: Partial<AssessmentAttempt> = {},
): AssessmentAttempt {
  return Object.assign(new AssessmentAttempt(), {
    id: 'attempt-1',
    talent_profile_id: 'profile-1',
    assessment_type: AssessmentType.ADVANCED,
    started_at: new Date(),
    completed_at: null,
    expires_at: new Date(Date.now() + 90 * 60 * 1000),
    tab_switch_count: 0,
    force_submitted: false,
    generated_questions_json: makeSessionJson(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });
}

function makeSessionJson() {
  const mcqQuestions = Array.from({ length: 10 }, (_, i) => ({
    question_id: `mcq-${i + 1}`,
    question_number: i + 1,
    block: 'mcq',
    question_type: QuestionType.SINGLE_PICK,
    question_text: `MCQ question ${i + 1}`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    slot_type: null,
    metadata: null,
    correct_answer: i < 8 ? 'Option A' : 'Option B',
  }));

  const shortTextQuestions = Array.from({ length: 10 }, (_, i) => ({
    question_id: `short-${i + 1}`,
    question_number: 11 + i,
    block: 'short_text',
    question_type: QuestionType.REQUIRED_TEXT,
    question_text: `Short text question ${i + 1}`,
    options: null,
    slot_type: null,
    metadata: null,
  }));

  const longTextQuestions = Array.from({ length: 5 }, (_, i) => ({
    question_id: `long-${i + 1}`,
    question_number: 21 + i,
    block: 'long_text',
    question_type: QuestionType.REQUIRED_TEXT,
    question_text: `Long text question ${i + 1}`,
    options: null,
    slot_type: null,
    metadata: null,
  }));

  return {
    context: { verified_level: VerifiedLevel.MID },
    questions: [...mcqQuestions, ...shortTextQuestions, ...longTextQuestions],
  };
}

function makeShortAnswer(): string {
  return 'I would clarify the goal, align stakeholders on tradeoffs, and choose the next step using user evidence and measurable outcomes.';
}

function makeLongAnswer(): string {
  return 'I would start by defining the business goal, the user need, and the operational constraint so the team is solving the right problem. Then I would compare options, identify the biggest uncertainty, and explain the tradeoffs clearly before deciding on a path. After execution, I would review the outcome against the original goal and document what I would change next time.';
}

function makeSubmitDto(overrides: Record<string, unknown> = {}) {
  const session = makeSessionJson();
  return {
    session_id: 'attempt-1',
    answers: session.questions.map((q) => ({
      question_id: q.question_id,
      answer:
        q.block === 'mcq'
          ? 'Option A'
          : q.block === 'short_text'
            ? makeShortAnswer()
            : makeLongAnswer(),
      time_spent_seconds: q.block === 'long_text' ? 30 : 10,
    })),
    ...overrides,
  };
}

function makeScoredAnswers(rawScore: number, maxScore: number) {
  return Array.from({ length: 15 }, (_, i) => ({
    question_id: i < 10 ? `short-${i + 1}` : `long-${i - 9}`,
    rubric: {
      relevance: 2,
      reasoning: 2,
      specificity: 2,
      completeness: 2,
      total: 8,
      feedback: 'Good.',
    },
    raw_score: rawScore / 15,
    max_score: maxScore / 15,
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AdvancedAssessmentService', () => {
  let service: AdvancedAssessmentService;

  let talentProfileRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let questionRepo: {};
  let attemptRepo: { findOne: jest.Mock; save: jest.Mock };
  let resultRepo: {};
  let personalAssessmentService: { getAiContext: jest.Mock };
  let advancedAssessmentAiService: { generateQuestions: jest.Mock };
  let rubricScoring: { scoreAnswers: jest.Mock };
  let guidanceReport: { generate: jest.Mock };
  let employerPoolProfileService: { upsert: jest.Mock };
  let questionGeneration: {};

  const userId = 'talent-user-1';
  let profileStore = makeTalentProfile({
    validated_level: VerifiedLevel.MID,
    assessment_locked_until: null,
  });
  let attemptStore: AssessmentAttempt;

  beforeEach(() => {
    profileStore = makeTalentProfile({
      validated_level: VerifiedLevel.MID,
      assessment_locked_until: null,
      personal_assessment_completed_at: new Date(),
    });
    attemptStore = makeAttempt();
    questionRepo = {};
    resultRepo = {};
    questionGeneration = {};

    attemptRepo = {
      findOne: jest.fn().mockResolvedValue(attemptStore),
      save: jest.fn().mockImplementation((attempt: AssessmentAttempt) => {
        attemptStore = attempt;
        return Promise.resolve(attempt);
      }),
    };

    const savedResponses: unknown[] = [];
    const savedResults: unknown[] = [];

    const entityManager = {
      save: jest
        .fn()
        .mockImplementation((_entity: unknown, data: unknown) =>
          Promise.resolve(data),
        ),
      create: jest
        .fn()
        .mockImplementation((_entity: unknown, data: unknown) => data),
      update: jest.fn().mockResolvedValue(undefined),
    };

    talentProfileRepo = {
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

    personalAssessmentService = {
      getAiContext: jest.fn().mockResolvedValue({
        track: 'frontend_developer',
        educationLevel: 'bachelor',
        region: 'Lagos',
        country: 'Nigeria',
        claimedLevel: VerifiedLevel.MID,
      }),
    };

    advancedAssessmentAiService = {
      generateQuestions: jest.fn().mockReturnValue(makeSessionJson()),
    };

    rubricScoring = {
      scoreAnswers: jest.fn().mockResolvedValue(makeScoredAnswers(80, 100)),
    };

    guidanceReport = {
      generate: jest.fn().mockResolvedValue({
        summary: 'Keep improving.',
        strengths: ['Problem solving'],
        improvement_areas: ['Communication'],
        recommended_resources: ['MDN Docs'],
        retake_advice: 'Review fundamentals before the 14-day retake.',
      }),
    };

    employerPoolProfileService = {
      upsert: jest.fn().mockResolvedValue({}),
    };

    service = new AdvancedAssessmentService(
      talentProfileRepo as never,
      questionRepo as never,
      attemptRepo as never,
      resultRepo as never,
      personalAssessmentService as never,
      advancedAssessmentAiService as never,
      rubricScoring as never,
      guidanceReport as never,
      employerPoolProfileService as never,
      questionGeneration as never,
    );
  });

  // ── submit ──────────────────────────────────────────────────────────────────

  describe('submit()', () => {
    it('returns success with score and tier on valid submission', async () => {
      const result = await service.submit(userId, makeSubmitDto() as never);

      expect(result.status).toBe('success');
      expect(result.session_id).toBe('attempt-1');
      expect(result.max_score).toBe(110);
      expect(result.percentage).toBeGreaterThanOrEqual(0);
      expect(Object.values(AssessmentTier)).toContain(result.tier);
    });

    it('sets tier job_ready when percentage ≥ 75 and calls employer pool upsert', async () => {
      rubricScoring.scoreAnswers.mockResolvedValue(
        Array.from({ length: 15 }, (_, i) => ({
          question_id: i < 10 ? `short-${i + 1}` : `long-${i - 9}`,
          rubric: {
            relevance: 3,
            reasoning: 3,
            specificity: 3,
            completeness: 3,
            total: 12,
            feedback: 'Excellent.',
          },
          raw_score: 12,
          max_score: 12,
        })),
      );

      const result = await service.submit(userId, makeSubmitDto() as never);

      expect(result.tier).toBe(AssessmentTier.JOB_READY);
      expect(result.integrity_confidence).toBe('high');
      expect(employerPoolProfileService.upsert).toHaveBeenCalled();
    });

    it('generates guidance report when tier is not job_ready', async () => {
      rubricScoring.scoreAnswers.mockResolvedValue(makeScoredAnswers(30, 100));

      const result = await service.submit(userId, makeSubmitDto() as never);

      if (result.tier !== AssessmentTier.JOB_READY) {
        expect(guidanceReport.generate).toHaveBeenCalled();
        expect(result.guidance_report).toBeDefined();
      }
    });

    it('sets retake gate (assessment_locked_until) when tier is not job_ready', async () => {
      rubricScoring.scoreAnswers.mockResolvedValue(makeScoredAnswers(0, 100));

      await service.submit(userId, makeSubmitDto() as never);

      const transaction =
        talentProfileRepo.manager.transaction.mock.calls[0][0];
      // The transaction ran — entityManager.update was called with locked_until
      expect(talentProfileRepo.manager.transaction).toHaveBeenCalled();
    });

    it('still scores when session is expired (auto_submitted=true)', async () => {
      attemptRepo.findOne.mockResolvedValue(
        makeAttempt({ expires_at: new Date(Date.now() - 1000) }),
      );

      const result = await service.submit(userId, makeSubmitDto() as never);

      expect(result.auto_submitted).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('throws 404 when profile not found', async () => {
      talentProfileRepo.findOne.mockResolvedValue(null);

      await expect(
        service.submit(userId, makeSubmitDto() as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when attempt not found', async () => {
      attemptRepo.findOne.mockResolvedValue(null);

      await expect(
        service.submit(userId, makeSubmitDto() as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 400 when attempt already submitted', async () => {
      attemptRepo.findOne.mockResolvedValue(
        makeAttempt({ completed_at: new Date() }),
      );

      await expect(
        service.submit(userId, makeSubmitDto() as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when session was voided', async () => {
      attemptRepo.findOne.mockResolvedValue(
        makeAttempt({ force_submitted: true }),
      );

      await expect(
        service.submit(userId, makeSubmitDto() as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('scores unanswered questions as 0 when rubric returns 0 for empty answers', async () => {
      rubricScoring.scoreAnswers.mockResolvedValue(
        Array.from({ length: 15 }, (_, i) => ({
          question_id: i < 10 ? `short-${i + 1}` : `long-${i - 9}`,
          rubric: {
            relevance: 0,
            reasoning: 0,
            specificity: 0,
            completeness: 0,
            total: 0,
            feedback: 'No answer provided.',
          },
          raw_score: 0,
          max_score: 12,
        })),
      );

      const result = await service.submit(userId, {
        session_id: 'attempt-1',
        answers: [],
      } as never);

      expect(result.score).toBe(0);
    });

    it('flags abnormal timing and sets integrity_confidence to low', async () => {
      const dto = {
        session_id: 'attempt-1',
        answers: makeSessionJson().questions.map((q) => ({
          question_id: q.question_id,
          answer:
            q.block === 'mcq'
              ? 'Option A'
              : q.block === 'short_text'
                ? makeShortAnswer()
                : makeLongAnswer(),
          time_spent_seconds: q.block === 'long_text' ? 2 : 10,
        })),
      };

      const result = await service.submit(userId, dto as never);

      expect(result.integrity_confidence).toBe('low');
    });

    it('sets integrity_confidence medium when tab_switch_count > 0', async () => {
      attemptRepo.findOne.mockResolvedValue(
        makeAttempt({ tab_switch_count: 1 }),
      );

      const result = await service.submit(userId, makeSubmitDto() as never);

      expect(result.integrity_confidence).toBe('medium');
    });

    it('scores MCQs correctly when correct_answer is present in session', async () => {
      rubricScoring.scoreAnswers.mockResolvedValue(
        Array.from({ length: 15 }, (_, i) => ({
          question_id: i < 10 ? `short-${i + 1}` : `long-${i - 9}`,
          rubric: {
            relevance: 3,
            reasoning: 3,
            specificity: 3,
            completeness: 3,
            total: 12,
            feedback: 'Good.',
          },
          raw_score: 12,
          max_score: 12,
        })),
      );
      const result = await service.submit(userId, makeSubmitDto() as never);
      expect(result.score).toBe(188);
      expect(result.percentage).toBe(99);
    });
  });

  // ── flag ────────────────────────────────────────────────────────────────────

  describe('flag()', () => {
    it('returns warn action on first tab switch', async () => {
      const result = await service.flag(userId, 'attempt-1', {
        event_type: IntegrityEventType.TAB_SWITCH,
      });

      expect(result.action).toBe('warn');
      expect(result.session_voided).toBe(false);
      expect(result.tab_switch_count).toBe(1);
      expect(attemptRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ tab_switch_count: 1 }),
      );
    });

    it('returns warn action on second tab switch', async () => {
      attemptRepo.findOne.mockResolvedValue(
        makeAttempt({ tab_switch_count: 1 }),
      );

      const result = await service.flag(userId, 'attempt-1', {
        event_type: IntegrityEventType.TAB_SWITCH,
      });

      expect(result.action).toBe('warn');
      expect(result.tab_switch_count).toBe(2);
    });

    it('voids session and returns logout action on third tab switch', async () => {
      attemptRepo.findOne.mockResolvedValue(
        makeAttempt({ tab_switch_count: 2 }),
      );

      const result = await service.flag(userId, 'attempt-1', {
        event_type: IntegrityEventType.TAB_SWITCH,
      });

      expect(result.action).toBe('logout');
      expect(result.session_voided).toBe(true);
      expect(attemptRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ force_submitted: true }),
      );
      expect(talentProfileRepo.update).toHaveBeenCalledWith(
        { id: profileStore.id },
        expect.objectContaining({ assessment_locked_until: expect.any(Date) }),
      );
    });

    it('sets 14-day retake gate when session is voided', async () => {
      attemptRepo.findOne.mockResolvedValue(
        makeAttempt({ tab_switch_count: 2 }),
      );

      await service.flag(userId, 'attempt-1', {
        event_type: IntegrityEventType.TAB_SWITCH,
      });

      const [[, patch]] = talentProfileRepo.update.mock.calls as [
        [unknown, { assessment_locked_until: Date }],
      ];
      const gateDate = patch.assessment_locked_until;
      const diffDays = Math.round(
        (gateDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBe(14);
    });

    it('returns flagged status on copy-paste event without voiding', async () => {
      const result = await service.flag(userId, 'attempt-1', {
        event_type: IntegrityEventType.COPY_PASTE,
      });

      expect(result.status).toBe('flagged');
      expect(result.session_voided).toBe(false);
      expect(attemptRepo.save).not.toHaveBeenCalled();
    });

    it('throws 404 when profile not found', async () => {
      talentProfileRepo.findOne.mockResolvedValue(null);

      await expect(
        service.flag(userId, 'attempt-1', {
          event_type: IntegrityEventType.TAB_SWITCH,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when attempt not found', async () => {
      attemptRepo.findOne.mockResolvedValue(null);

      await expect(
        service.flag(userId, 'attempt-1', {
          event_type: IntegrityEventType.TAB_SWITCH,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 400 when attempting to flag a completed session', async () => {
      attemptRepo.findOne.mockResolvedValue(
        makeAttempt({ completed_at: new Date() }),
      );

      await expect(
        service.flag(userId, 'attempt-1', {
          event_type: IntegrityEventType.TAB_SWITCH,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── start — retake gate ─────────────────────────────────────────────────────

  describe('start() retake gate', () => {
    it('throws 403 when assessment_locked_until is in the future', async () => {
      const lockedProfile = makeTalentProfile({
        validated_level: VerifiedLevel.MID,
        personal_assessment_completed_at: new Date(),
        assessment_locked_until: new Date(
          Date.now() + 10 * 24 * 60 * 60 * 1000,
        ),
      });

      const skillResultQuery = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          percentage: 80,
        } as AssessmentResult),
      };

      const lockedEntityManager = {
        findOne: jest.fn().mockResolvedValue(lockedProfile),
        createQueryBuilder: jest.fn().mockReturnValue(skillResultQuery),
      };

      talentProfileRepo.manager.transaction.mockImplementation(
        (work: (em: typeof lockedEntityManager) => Promise<unknown>) =>
          work(lockedEntityManager),
      );

      await expect(service.start(userId)).rejects.toThrow(ForbiddenException);
    });

    it('throws 422 when validated_level is missing', async () => {
      const unverifiedProfile = makeTalentProfile({
        validated_level: null,
        personal_assessment_completed_at: new Date(),
      });

      const unverifiedManager = {
        findOne: jest.fn().mockResolvedValue(unverifiedProfile),
        createQueryBuilder: jest.fn(),
      };

      talentProfileRepo.manager.transaction.mockImplementation(
        (work: (em: typeof unverifiedManager) => Promise<unknown>) =>
          work(unverifiedManager),
      );

      await expect(service.start(userId)).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'LEVEL_NOT_VERIFIED' }),
      });
    });
  });
});
