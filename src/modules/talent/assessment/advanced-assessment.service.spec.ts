import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AssessmentTier } from '../../assessments/entities/assessment-result.entity';
import {
  AssessmentAttempt,
  AssessmentScore,
  AssessmentScoreQuestionType,
  AssessmentType,
  QuestionType,
  SlotType,
} from '../../assessments/entities';
import { AssessmentResult } from '../../assessments/entities/assessment-result.entity';
import { VerifiedLevel } from '../../assessments/entities/assessment-question.entity';
import { AdvancedAssessmentService } from './advanced-assessment.service';
import { ErrorMessages } from '../../../shared';
import { IntegrityEventType } from './dto/advanced-assessment.dto';
import { TalentProfile } from '../entities/talent-profile.entity';
import { makeTalentProfile } from './personal-assessment.test-fixtures';

// ── Helpers ───────────────────────────────────────────────────────────────────

const LT_ANSWER =
  'I would start by defining the business goal, the user need, and the operational constraint so the team is solving the right problem. ' +
  'Then I would compare options, identify the biggest uncertainty, and explain the tradeoffs clearly before deciding on a path. ' +
  'After execution, I would review the outcome against the original goal and document what I would change next time.';

const SHORT_ANSWER =
  'I would clarify the goal, align stakeholders on tradeoffs, and choose the next step using user evidence and measurable outcomes.';

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
    copy_paste_count: 0,
    force_submitted: false,
    generated_questions_json: makeSessionJson(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });
}

/**
 * 5 MCQ + 10 short text + 2 LT-1 (SITUATIONAL) + 2 LT-2 (WORK_TASK) + 1
 * LT-3 (REFLECTION, runtime-generated). For tests we pre-populate the
 * reflection slot so submit() doesn't hit the LT2_NOT_SUBMITTED guard.
 */
function makeSessionJson() {
  const mcqQuestions = Array.from({ length: 5 }, (_, i) => ({
    question_id: `mcq-${i + 1}`,
    question_number: i + 1,
    block: 'mcq',
    question_type: QuestionType.SINGLE_PICK,
    question_text: `MCQ question ${i + 1}`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    slot_type: null,
    metadata: { competency: 'sql_queries' },
    correct_answer: i < 4 ? 'Option A' : 'Option B',
  }));

  const shortTextQuestions = Array.from({ length: 10 }, (_, i) => ({
    question_id: `short-${i + 1}`,
    question_number: 6 + i,
    block: 'short_text',
    question_type: QuestionType.REQUIRED_TEXT,
    question_text: `Short text question ${i + 1}`,
    options: null,
    slot_type: SlotType.SITUATIONAL,
    metadata: { competency: 'debugging' },
    correct_answer: null,
  }));

  const longTextSlots = [
    SlotType.SITUATIONAL, // LT-1 (a)
    SlotType.SITUATIONAL, // LT-1 (b)
    SlotType.WORK_TASK, // LT-2 (a)
    SlotType.WORK_TASK, // LT-2 (b)
    SlotType.REFLECTION, // LT-3 (runtime-generated)
  ];
  const longTextQuestions = longTextSlots.map((slot_type, i) => ({
    question_id: `long-${i + 1}`,
    question_number: 16 + i,
    block: 'long_text',
    question_type: QuestionType.OPTIONAL_TEXT,
    question_text: `Long text question ${i + 1} (${slot_type})`,
    options: null,
    slot_type,
    metadata: { competency: 'system_design' },
    correct_answer: null,
  }));

  return {
    context: { verified_level: VerifiedLevel.MID },
    questions: [...mcqQuestions, ...shortTextQuestions, ...longTextQuestions],
  };
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
            ? SHORT_ANSWER
            : LT_ANSWER,
      time_spent_seconds: q.block === 'long_text' ? 30 : 10,
    })),
    ...overrides,
  };
}

/**
 * Returns 15 scored text answers in the canonical scoring shape:
 * 10 short (max 12) + 2 LT-1 (max 12) + 2 LT-2 (max 12) + 1 LT-3 (max 8).
 * The caller distributes total raw across all answers proportionally.
 */
function makeScoredAnswers(rawTotal: number, maxTotal = 176) {
  // 14 full-rubric questions (max 12 each = 168) + 1 LT-3 (max 8) = 176
  const proportion = rawTotal / maxTotal;
  const result = [];

  for (let i = 0; i < 10; i++) {
    const raw = Math.round(12 * proportion);
    result.push({
      question_id: `short-${i + 1}`,
      rubric: {
        relevance: 2,
        reasoning: 2,
        specificity: 2,
        completeness: 2,
        total: raw,
        feedback: 'Good.',
      },
      raw_score: raw,
      max_score: 12,
    });
  }

  // LT-1 (a), LT-1 (b), LT-2 (a), LT-2 (b)
  for (let i = 0; i < 4; i++) {
    const raw = Math.round(12 * proportion);
    result.push({
      question_id: `long-${i + 1}`,
      rubric: {
        relevance: 2,
        reasoning: 2,
        specificity: 2,
        completeness: 2,
        total: raw,
        feedback: 'Good.',
      },
      raw_score: raw,
      max_score: 12,
    });
  }

  // LT-3 (reflection): 2 dims 0-4, max 8
  const lt3Raw = Math.round(8 * proportion);
  result.push({
    question_id: 'long-5',
    rubric: {
      relevance: 2,
      reasoning: 2,
      specificity: 0,
      completeness: 0,
      total: lt3Raw,
      feedback: 'Reflective.',
    },
    raw_score: lt3Raw,
    max_score: 8,
  });

  return result;
}

function makePerfectScoredAnswers() {
  return makeScoredAnswers(176, 176);
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
  let attemptRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    increment: jest.Mock;
    update: jest.Mock;
  };
  let resultRepo: { update: jest.Mock };
  let personalAssessmentService: { getAiContext: jest.Mock };
  let advancedAssessmentAiService: { generateQuestions: jest.Mock };
  let rubricScoring: { scoreAnswers: jest.Mock };
  let guidanceReport: { generate: jest.Mock };
  let lt3Generation: { generate: jest.Mock };
  let employerPoolProfileService: { upsert: jest.Mock };
  let questionGeneration: { generateQuestions?: jest.Mock };
  let usersService: { findOne: jest.Mock };
  let notificationDispatch: { dispatch: jest.Mock };

  // Cross-test captures
  let entityManagerSaveCalls: Array<{ entity: unknown; data: unknown }>;
  let entityManagerFindOne: jest.Mock;
  let entityManagerIncrement: jest.Mock;
  let entityManagerUpdate: jest.Mock;

  const userId = 'talent-user-1';
  let profileStore = makeTalentProfile({
    validated_level: VerifiedLevel.MID,
    assessment_locked_until: null,
  });
  let attemptStore: AssessmentAttempt;
  let attemptData: { current: AssessmentAttempt };

  beforeEach(() => {
    profileStore = makeTalentProfile({
      validated_level: VerifiedLevel.MID,
      assessment_locked_until: null,
      personal_assessment_completed_at: new Date(),
      track: 'software_eng',
    });
    attemptStore = makeAttempt();
    attemptData = { current: attemptStore };
    questionRepo = {};
    resultRepo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    questionGeneration = {};
    entityManagerSaveCalls = [];
    entityManagerFindOne = jest
      .fn()
      .mockImplementation((_entity: unknown) =>
        Promise.resolve(
          Object.assign(new AssessmentAttempt(), attemptData.current),
        ),
      );
    entityManagerIncrement = jest
      .fn()
      .mockImplementation(
        (
          _entity: unknown,
          _criteria: Record<string, unknown>,
          field: string,
          value: number,
        ) => {
          const current = attemptData.current;
          if (field === 'tab_switch_count') {
            current.tab_switch_count += value;
          } else if (field === 'copy_paste_count') {
            current.copy_paste_count += value;
          }
          return Promise.resolve({ affected: 1 });
        },
      );
    entityManagerUpdate = jest.fn().mockResolvedValue(undefined);

    attemptRepo = {
      findOne: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            Object.assign(new AssessmentAttempt(), attemptData.current),
          ),
        ),
      save: jest.fn().mockImplementation((attempt: AssessmentAttempt) => {
        attemptData.current = attempt;
        return Promise.resolve(attempt);
      }),
      increment: jest
        .fn()
        .mockImplementation(
          (
            _criteria: Record<string, unknown>,
            field: string,
            value: number,
          ) => {
            const current = attemptData.current;
            if (field === 'tab_switch_count') {
              current.tab_switch_count += value;
            } else if (field === 'copy_paste_count') {
              current.copy_paste_count += value;
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
            Object.assign(attemptData.current, patch);
            return Promise.resolve({ affected: 1 });
          },
        ),
    };

    const entityManager = {
      findOne: entityManagerFindOne,
      increment: entityManagerIncrement,
      count: jest.fn().mockResolvedValue(1),
      save: jest.fn().mockImplementation((entity: unknown, data: unknown) => {
        entityManagerSaveCalls.push({ entity, data });
        return Promise.resolve(data);
      }),
      create: jest
        .fn()
        .mockImplementation((_entity: unknown, data: unknown) => data),
      update: entityManagerUpdate,
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
        track: 'software_eng',
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
      // 80/176 ≈ 45% raw text yield → still emerging band by default
      scoreAnswers: jest.fn().mockResolvedValue(makeScoredAnswers(80, 176)),
    };

    guidanceReport = {
      generate: jest.fn().mockImplementation((input) =>
        Promise.resolve({
          report_type: input.report_type,
          ai_summary:
            'You demonstrate practical problem solving and clear product intuition. Your growth opportunities currently lie in communication and systems thinking.',
          growth_insight:
            'Your recent assessments show steady progress in structured thinking. Focusing on communication and systems thinking could improve your professional readiness.',
          summary:
            input.report_type === 'job_ready'
              ? 'You showed job-ready strengths.'
              : 'Keep improving.',
          strength_ratings: [
            { item: 'Clear practical problem solving.', rating: 3 },
            { item: 'Good product intuition.', rating: 2 },
            { item: 'Structured answer flow.', rating: 2 },
          ],
          weak_area_ratings: [
            { item: 'Needs clearer communication.', rating: 2 },
            { item: 'Improve systems-level reasoning.', rating: 1 },
            { item: 'Build confidence under ambiguity.', rating: 1 },
          ],
          recommended_resources: [
            {
              title: 'MDN Docs',
              provider: 'MDN',
              url: 'https://developer.mozilla.org/',
              tier: 'free',
              competency: 'Communication',
              reason: 'Strengthens practical fundamentals.',
            },
          ],
          ...(input.report_type === 'emerging' && {
            retake_advice: 'Review fundamentals before the 14-day retake.',
          }),
          resource_page_url: '/resources',
        }),
      ),
    };

    lt3Generation = {
      generate: jest.fn().mockResolvedValue({
        question_text:
          'You mentioned aligning stakeholders on tradeoffs. Why did you choose that path, and what would you do differently next time?',
      }),
    };

    employerPoolProfileService = {
      upsert: jest.fn().mockResolvedValue({}),
    };

    usersService = {
      findOne: jest.fn().mockResolvedValue({
        id: userId,
        email: 'talent@example.com',
        first_name: 'Jane',
        last_name: 'Doe',
      }),
    };

    notificationDispatch = {
      dispatch: jest.fn().mockResolvedValue(undefined),
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
      lt3Generation as never,
      employerPoolProfileService as never,
      questionGeneration as never,
      usersService as never,
      notificationDispatch as never,
    );
  });

  // ── submit ──────────────────────────────────────────────────────────────────

  describe('submit()', () => {
    const ADVANCED_MAX_SCORE = 100;

    it('returns weighted max_score (100) for a complete session', async () => {
      // perfect text scoring + all MCQ correct
      rubricScoring.scoreAnswers.mockResolvedValue(makePerfectScoredAnswers());
      const result = await service.submit(userId, makeSubmitDto() as never);

      expect(result.max_score).toBe(ADVANCED_MAX_SCORE);
      expect(result.status).toBe('success');
      expect(result.session_id).toBe('attempt-1');
      expect(Object.values(AssessmentTier)).toContain(result.tier);
    });

    it('rejects with 422 LT2_NOT_SUBMITTED when reflection slot is missing', async () => {
      const sessionWithoutLt3 = makeSessionJson();
      sessionWithoutLt3.questions = sessionWithoutLt3.questions.filter(
        (q) => q.slot_type !== SlotType.REFLECTION,
      );
      attemptRepo.findOne.mockResolvedValue(
        makeAttempt({ generated_questions_json: sessionWithoutLt3 }),
      );

      await expect(
        service.submit(userId, makeSubmitDto() as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'LT2_NOT_SUBMITTED' }),
      });
    });

    it('routes the REFLECTION slot through is_lt3=true and others through full rubric', async () => {
      rubricScoring.scoreAnswers.mockResolvedValue(makeScoredAnswers(80, 176));
      await service.submit(userId, makeSubmitDto() as never);

      const inputs = rubricScoring.scoreAnswers.mock.calls[0][0];
      const lt3 = inputs.find(
        (i: { is_lt3?: boolean; question_id: string }) =>
          i.question_id === 'long-5',
      );
      const lt1 = inputs.find(
        (i: { is_lt3?: boolean; question_id: string }) =>
          i.question_id === 'long-1',
      );
      expect(lt3.is_lt3).toBe(true);
      expect(lt1.is_lt3).toBe(false);
    });

    it('sets tier job_ready at >= 75% and calls employer pool upsert', async () => {
      rubricScoring.scoreAnswers.mockResolvedValue(makePerfectScoredAnswers());
      const result = await service.submit(userId, makeSubmitDto() as never);

      expect(result.percentage).toBeGreaterThanOrEqual(75);
      expect(result.tier).toBe(AssessmentTier.JOB_READY);
      expect(result.integrity_confidence).toBe('high');
      expect(guidanceReport.generate).toHaveBeenCalledWith(
        expect.objectContaining({ report_type: 'job_ready' }),
      );
      expect(result.guidance_report).toBeUndefined();
      await Promise.resolve();
      expect(resultRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          guidance_report: expect.objectContaining({
            report_type: 'job_ready',
            ai_summary: expect.any(String),
            growth_insight: expect.any(String),
            resource_page_url: '/resources',
          }),
        }),
      );
      expect(employerPoolProfileService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          competencyByQuestion: expect.any(Map),
        }),
      );
    });

    it('keeps tier emerging when text scores are high but all MCQs are wrong', async () => {
      rubricScoring.scoreAnswers.mockResolvedValue(makePerfectScoredAnswers());
      const dto = makeSubmitDto();
      dto.answers = dto.answers.map((answer) =>
        String(answer.question_id).startsWith('mcq-')
          ? { ...answer, answer: 'Option C' }
          : answer,
      );

      const result = await service.submit(userId, dto as never);

      expect(result.percentage).toBeLessThan(75);
      expect(result.tier).toBe(AssessmentTier.EMERGING);
      expect(employerPoolProfileService.upsert).not.toHaveBeenCalled();
    });

    it('can still be job_ready with high text scores and at least one correct MCQ', async () => {
      rubricScoring.scoreAnswers.mockResolvedValue(makePerfectScoredAnswers());
      const dto = makeSubmitDto();
      dto.answers = dto.answers.map((answer) => {
        if (!String(answer.question_id).startsWith('mcq-')) return answer;
        return {
          ...answer,
          answer: answer.question_id === 'mcq-1' ? 'Option A' : 'Option C',
        };
      });

      const result = await service.submit(userId, dto as never);

      expect(result.percentage).toBeGreaterThanOrEqual(75);
      expect(result.tier).toBe(AssessmentTier.JOB_READY);
    });

    it('fails closed when the session has no MCQs', async () => {
      rubricScoring.scoreAnswers.mockResolvedValue(makePerfectScoredAnswers());
      const loggerErrorSpy = jest
        .spyOn(
          (
            service as unknown as {
              logger: { error: (...args: unknown[]) => void };
            }
          ).logger,
          'error',
        )
        .mockImplementation(() => undefined);

      const sessionNoMcq = makeSessionJson();
      sessionNoMcq.questions = sessionNoMcq.questions.filter(
        (question) => question.block !== 'mcq',
      );
      attemptStore = makeAttempt({ generated_questions_json: sessionNoMcq });
      attemptRepo.findOne.mockResolvedValue(attemptStore);

      const dto = makeSubmitDto();
      dto.answers = dto.answers.filter(
        (answer) => !String(answer.question_id).startsWith('mcq-'),
      );

      const result = await service.submit(userId, dto as never);

      expect(result.tier).toBe(AssessmentTier.EMERGING);
      expect(result.percentage).toBeGreaterThanOrEqual(75);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('MCQ gate failed'),
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`attempt=${attemptStore.id}`),
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`user=${userId}`),
      );
    });

    it('places tier at Emerging when pct < 75%', async () => {
      // Need ~60% of 181 = 109; choose 100/176 text raw → MCQ also high
      rubricScoring.scoreAnswers.mockResolvedValue(makeScoredAnswers(115, 176));
      const result = await service.submit(userId, makeSubmitDto() as never);

      expect(result.percentage).toBeLessThan(75);
      expect(result.tier).toBe(AssessmentTier.EMERGING);
    });

    it('marks sub-50% as failed without profile completion or guidance report', async () => {
      rubricScoring.scoreAnswers.mockResolvedValue(makeScoredAnswers(0, 176));
      const result = await service.submit(userId, {
        session_id: 'attempt-1',
        answers: [],
      } as never);

      expect(result.failed).toBe(true);
      expect(result.status).toBe('failed');
      expect(result.percentage).toBeLessThan(50);
      expect(result.tier).toBe(AssessmentTier.NOT_READY);
      expect(guidanceReport.generate).not.toHaveBeenCalled();
      expect(entityManagerUpdate).not.toHaveBeenCalledWith(
        TalentProfile,
        { id: profileStore.id },
        expect.objectContaining({
          advanced_assessment_completed_at: expect.any(Date),
        }),
      );
      expect(notificationDispatch.dispatch).not.toHaveBeenCalled();
    });

    it('writes one assessment_scores row per session question (20)', async () => {
      rubricScoring.scoreAnswers.mockResolvedValue(makePerfectScoredAnswers());
      await service.submit(userId, makeSubmitDto() as never);

      const scoreSaveCall = entityManagerSaveCalls.find(
        (call) => call.entity === AssessmentScore,
      );
      expect(scoreSaveCall).toBeDefined();
      const rows = scoreSaveCall!.data as Array<{
        question_type: AssessmentScoreQuestionType;
        max_score: number;
      }>;
      expect(rows).toHaveLength(20);

      const mcqRows = rows.filter(
        (r) => r.question_type === AssessmentScoreQuestionType.MCQ,
      );
      const shortRows = rows.filter(
        (r) => r.question_type === AssessmentScoreQuestionType.SHORT_TEXT,
      );
      const longRows = rows.filter(
        (r) => r.question_type === AssessmentScoreQuestionType.LONG_TEXT,
      );
      expect(mcqRows).toHaveLength(5);
      expect(shortRows).toHaveLength(10);
      expect(longRows).toHaveLength(5);
      // LT-3 row carries max_score=8
      expect(longRows.find((r) => r.max_score === 8)).toBeDefined();
    });

    it('sets retake gate (assessment_locked_until) when tier is not job_ready', async () => {
      rubricScoring.scoreAnswers.mockResolvedValue(makeScoredAnswers(100, 176));

      await service.submit(userId, makeSubmitDto() as never);
      expect(entityManagerUpdate).toHaveBeenCalledWith(
        TalentProfile,
        { id: profileStore.id },
        expect.objectContaining({
          assessment_locked_from: expect.any(Date),
          assessment_locked_until: expect.any(Date),
          advanced_retake_required: true,
        }),
      );
      const [, , patch] = entityManagerUpdate.mock.calls.find(
        (call) => call[0] === TalentProfile,
      ) as [
        unknown,
        unknown,
        { assessment_locked_from: Date; assessment_locked_until: Date },
      ];
      expect(patch.assessment_locked_from.getTime()).toBeLessThanOrEqual(
        patch.assessment_locked_until.getTime(),
      );
      const diffDays = Math.round(
        (patch.assessment_locked_until.getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBe(14);
    });

    it('clears retake lock dates when tier is job_ready', async () => {
      rubricScoring.scoreAnswers.mockResolvedValue(makePerfectScoredAnswers());

      await service.submit(userId, makeSubmitDto() as never);

      expect(entityManagerUpdate).toHaveBeenCalledWith(
        TalentProfile,
        { id: profileStore.id },
        expect.objectContaining({
          assessment_locked_from: null,
          assessment_locked_until: null,
          advanced_retake_required: false,
        }),
      );
    });

    it('throws 403 with probation metadata when profile lock is active', async () => {
      const lockedFrom = new Date('2026-05-01T00:00:00.000Z');
      const lockedUntil = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      talentProfileRepo.findOne.mockResolvedValue(
        makeTalentProfile({
          advanced_retake_required: true,
          assessment_locked_from: lockedFrom,
          assessment_locked_until: lockedUntil,
        }),
      );

      await expect(
        service.submit(userId, makeSubmitDto() as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          error: 'ADVANCED_RETAKE_LOCKED',
          probation_started_at: lockedFrom.toISOString(),
          probation_ends_at: lockedUntil.toISOString(),
          remaining_seconds: expect.any(Number),
        }),
      });
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

    it('flags abnormal long-text timing and sets integrity_confidence to low', async () => {
      const dto = {
        session_id: 'attempt-1',
        answers: makeSessionJson().questions.map((q) => ({
          question_id: q.question_id,
          answer:
            q.block === 'mcq'
              ? 'Option A'
              : q.block === 'short_text'
                ? SHORT_ANSWER
                : LT_ANSWER,
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

    it('sets integrity_confidence medium when copy_paste_count > 0', async () => {
      attemptRepo.findOne.mockResolvedValue(
        makeAttempt({ copy_paste_count: 1 }),
      );

      const result = await service.submit(userId, makeSubmitDto() as never);

      expect(result.integrity_confidence).toBe('medium');
    });

    describe('tier boundary cases', () => {
      it('49% → Emerging', async () => {
        rubricScoring.scoreAnswers.mockResolvedValue(
          makeScoredAnswers(85, 176),
        );
        const result = await service.submit(userId, {
          session_id: 'attempt-1',
          answers: [], // 0 MCQ correct → text contributes ~85 + 0 mcq
        } as never);
        expect(result.percentage).toBeLessThan(75);
        expect(result.tier).toBe(AssessmentTier.EMERGING);
      });

      it('75% → Job Ready', async () => {
        rubricScoring.scoreAnswers.mockResolvedValue(
          makePerfectScoredAnswers(),
        );
        const result = await service.submit(userId, makeSubmitDto() as never);
        expect(result.percentage).toBeGreaterThanOrEqual(75);
        expect(result.tier).toBe(AssessmentTier.JOB_READY);
      });
    });
  });

  // ── submitLt2 ───────────────────────────────────────────────────────────────

  describe('submitLt2()', () => {
    const validAnswer = LT_ANSWER;

    beforeEach(() => {
      // Strip the pre-baked REFLECTION question so submitLt2 has work to do.
      const sessionNoLt3 = makeSessionJson();
      sessionNoLt3.questions = sessionNoLt3.questions.filter(
        (q) => q.slot_type !== SlotType.REFLECTION,
      );
      attemptStore = makeAttempt({ generated_questions_json: sessionNoLt3 });
      attemptRepo.findOne.mockResolvedValue(attemptStore);
    });

    it('generates an LT-3 question and appends it to the session', async () => {
      const result = await service.submitLt2(userId, 'attempt-1', {
        question_id: 'long-4', // last WORK_TASK
        answer: validAnswer,
      });

      expect(result.status).toBe('success');
      expect(result.question_text).toContain('aligning stakeholders');
      expect(lt3Generation.generate).toHaveBeenCalledTimes(1);
    });

    it('is idempotent: second call returns the same LT-3 without re-invoking the LLM', async () => {
      // First call: prime the session
      await service.submitLt2(userId, 'attempt-1', {
        question_id: 'long-4',
        answer: validAnswer,
      });

      // The attempt was mutated in-place by the first call. Reset the
      // findOne mock to return that updated attempt for the second call.
      attemptRepo.findOne.mockResolvedValue(attemptStore);
      lt3Generation.generate.mockClear();

      const second = await service.submitLt2(userId, 'attempt-1', {
        question_id: 'long-4',
        answer: validAnswer,
      });

      expect(second.status).toBe('success');
      expect(lt3Generation.generate).not.toHaveBeenCalled();
    });

    it('throws 422 LT2_QUESTION_MISMATCH when question_id is not LT-2', async () => {
      await expect(
        service.submitLt2(userId, 'attempt-1', {
          question_id: 'long-1', // SITUATIONAL, not WORK_TASK
          answer: validAnswer,
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 503 LT3_GENERATION_FAILED when the LLM call fails', async () => {
      lt3Generation.generate.mockRejectedValue(new Error('openrouter 500'));

      await expect(
        service.submitLt2(userId, 'attempt-1', {
          question_id: 'long-4',
          answer: validAnswer,
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws 400 when attempt has already been submitted', async () => {
      attemptRepo.findOne.mockResolvedValue(
        makeAttempt({ completed_at: new Date() }),
      );
      await expect(
        service.submitLt2(userId, 'attempt-1', {
          question_id: 'long-4',
          answer: validAnswer,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 422 SESSION_EXPIRED when the timer has run out', async () => {
      attemptRepo.findOne.mockResolvedValue(
        makeAttempt({ expires_at: new Date(Date.now() - 1000) }),
      );
      await expect(
        service.submitLt2(userId, 'attempt-1', {
          question_id: 'long-4',
          answer: validAnswer,
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('calls manager.update (not manager.save) to persist the LT-3 session update', async () => {
      await service.submitLt2(userId, 'attempt-1', {
        question_id: 'long-4',
        answer: LT_ANSWER,
      });

      const attemptUpdateCall = entityManagerUpdate.mock.calls.find(
        ([entity, criteria]) =>
          entity === AssessmentAttempt &&
          (criteria as Record<string, unknown>).id === 'attempt-1',
      );
      expect(attemptUpdateCall).toBeDefined();
    });

    it('includes the REFLECTION slot in the generated_questions_json written by manager.update', async () => {
      await service.submitLt2(userId, 'attempt-1', {
        question_id: 'long-4',
        answer: LT_ANSWER,
      });

      const attemptUpdateCall = entityManagerUpdate.mock.calls.find(
        ([entity, criteria]) =>
          entity === AssessmentAttempt &&
          (criteria as Record<string, unknown>).id === 'attempt-1',
      );
      const [, , patch] = attemptUpdateCall as [
        unknown,
        unknown,
        Record<string, unknown>,
      ];
      const updatedJson = patch.generated_questions_json as {
        questions: Array<{ slot_type: string }>;
      };
      expect(
        updatedJson.questions.some((q) => q.slot_type === SlotType.REFLECTION),
      ).toBe(true);
    });

    it('does not call manager.save for the attempt entity when persisting LT-3', async () => {
      await service.submitLt2(userId, 'attempt-1', {
        question_id: 'long-4',
        answer: LT_ANSWER,
      });

      const attemptSaveCall = entityManagerSaveCalls.find(
        ({ entity }) => entity === AssessmentAttempt,
      );
      expect(attemptSaveCall).toBeUndefined();
    });

    it('updates attempt.generated_questions_json in-memory after manager.update so the idempotency guard sees LT-3', async () => {
      await service.submitLt2(userId, 'attempt-1', {
        question_id: 'long-4',
        answer: LT_ANSWER,
      });

      // attemptStore is the same object returned by findOne (mockResolvedValue returns same ref)
      const inMemoryQuestions = (
        attemptStore.generated_questions_json as {
          questions: Array<{ slot_type: string }>;
        }
      ).questions;
      expect(
        inMemoryQuestions.some((q) => q.slot_type === SlotType.REFLECTION),
      ).toBe(true);
    });

    it('throws 403 with probation metadata when profile lock is active', async () => {
      const lockedFrom = new Date('2026-05-01T00:00:00.000Z');
      const lockedUntil = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      talentProfileRepo.findOne.mockResolvedValue(
        makeTalentProfile({
          advanced_retake_required: true,
          assessment_locked_from: lockedFrom,
          assessment_locked_until: lockedUntil,
        }),
      );

      await expect(
        service.submitLt2(userId, 'attempt-1', {
          question_id: 'long-4',
          answer: validAnswer,
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          error: 'ADVANCED_RETAKE_LOCKED',
          probation_started_at: lockedFrom.toISOString(),
          probation_ends_at: lockedUntil.toISOString(),
        }),
      });
    });
  });

  // ── getSession ──────────────────────────────────────────────────────────────

  describe('getSession()', () => {
    it('throws 403 with probation metadata when profile lock is active', async () => {
      const lockedFrom = new Date('2026-05-01T00:00:00.000Z');
      const lockedUntil = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      talentProfileRepo.findOne.mockResolvedValue(
        makeTalentProfile({
          advanced_retake_required: true,
          assessment_locked_from: lockedFrom,
          assessment_locked_until: lockedUntil,
        }),
      );

      await expect(
        service.getSession(userId, 'attempt-1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          error: 'ADVANCED_RETAKE_LOCKED',
          probation_started_at: lockedFrom.toISOString(),
          probation_ends_at: lockedUntil.toISOString(),
        }),
      });
    });
  });

  // ── flag ────────────────────────────────────────────────────────────────────

  describe('flag()', () => {
    it('voids session and returns logout action on tab switch', async () => {
      const result = await service.flag(userId, 'attempt-1', {
        event_type: IntegrityEventType.TAB_SWITCH,
      });

      expect(result.status).toBe('voided');
      expect(result.action).toBe('logout');
      expect(result.session_voided).toBe(true);
      expect(result.tab_switch_count).toBe(1);
      expect(talentProfileRepo.manager.transaction).toHaveBeenCalled();
      expect(entityManagerFindOne).toHaveBeenCalledWith(
        AssessmentAttempt,
        expect.objectContaining({
          lock: { mode: 'pessimistic_write' },
        }),
      );
      expect(entityManagerIncrement).toHaveBeenCalledWith(
        AssessmentAttempt,
        expect.anything(),
        'tab_switch_count',
        1,
      );
      expect(entityManagerUpdate).toHaveBeenCalledWith(
        AssessmentAttempt,
        expect.anything(),
        expect.objectContaining({ force_submitted: true }),
      );
      expect(entityManagerUpdate).toHaveBeenCalledWith(
        TalentProfile,
        { id: profileStore.id },
        expect.objectContaining({
          assessment_locked_from: expect.any(Date),
          assessment_locked_until: expect.any(Date),
          advanced_retake_required: true,
        }),
      );
    });

    it('sets 14-day retake gate when session is voided', async () => {
      await service.flag(userId, 'attempt-1', {
        event_type: IntegrityEventType.TAB_SWITCH,
      });

      const profileUpdate = entityManagerUpdate.mock.calls.find(
        ([entity]) => entity === TalentProfile,
      ) as [
        unknown,
        unknown,
        { assessment_locked_from: Date; assessment_locked_until: Date },
      ];
      const [, , patch] = profileUpdate;
      const gateDate = patch.assessment_locked_until;
      expect(patch.assessment_locked_from).toBeInstanceOf(Date);
      const diffDays = Math.round(
        (gateDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBe(14);
    });

    it('increments copy_paste_count on COPY_PASTE and voids session', async () => {
      const result = await service.flag(userId, 'attempt-1', {
        event_type: IntegrityEventType.COPY_PASTE,
      });

      expect(result.status).toBe('voided');
      expect(result.action).toBe('logout');
      expect(result.session_voided).toBe(true);
      expect(result.copy_paste_count).toBe(1);
      expect(entityManagerIncrement).toHaveBeenCalledWith(
        AssessmentAttempt,
        expect.anything(),
        'copy_paste_count',
        1,
      );
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
      entityManagerFindOne.mockResolvedValueOnce(null);

      await expect(
        service.flag(userId, 'attempt-1', {
          event_type: IntegrityEventType.TAB_SWITCH,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 400 when attempting to flag a completed session', async () => {
      entityManagerFindOne.mockResolvedValueOnce(
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
      const lockedFrom = new Date('2026-05-01T00:00:00.000Z');
      const lockedUntil = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const lockedProfile = makeTalentProfile({
        validated_level: VerifiedLevel.MID,
        personal_assessment_completed_at: new Date(),
        advanced_retake_required: true,
        assessment_locked_from: lockedFrom,
        assessment_locked_until: lockedUntil,
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
        count: jest.fn().mockResolvedValue(1),
        createQueryBuilder: jest.fn().mockReturnValue(skillResultQuery),
      };

      talentProfileRepo.manager.transaction.mockImplementation(
        (work: (em: typeof lockedEntityManager) => Promise<unknown>) =>
          work(lockedEntityManager),
      );

      await expect(service.start(userId)).rejects.toMatchObject({
        response: expect.objectContaining({
          error: 'ADVANCED_RETAKE_LOCKED',
          probation_started_at: lockedFrom.toISOString(),
          probation_ends_at: lockedUntil.toISOString(),
          remaining_seconds: expect.any(Number),
        }),
      });
    });

    it('throws 422 when no skill assessment attempt has been completed', async () => {
      const profile = makeTalentProfile({
        validated_level: VerifiedLevel.MID,
        personal_assessment_completed_at: new Date(),
      });

      const entityManager = {
        findOne: jest.fn().mockResolvedValue(profile),
        count: jest.fn().mockResolvedValue(0),
        createQueryBuilder: jest.fn(),
      };

      talentProfileRepo.manager.transaction.mockImplementation(
        (work: (em: typeof entityManager) => Promise<unknown>) =>
          work(entityManager),
      );

      await expect(service.start(userId)).rejects.toMatchObject({
        response: expect.objectContaining({
          message: ErrorMessages.ADVANCED_ASSESSMENT.SKILL_GATE_REQUIRED,
        }),
      });
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

    it('allows start when the latest skill result is below the pass threshold', async () => {
      const profile = makeTalentProfile({
        validated_level: VerifiedLevel.MID,
        personal_assessment_completed_at: new Date(),
        assessment_locked_until: null,
      });

      const makeQuery = (overrides: Record<string, jest.Mock> = {}) => {
        const query: Record<string, jest.Mock> = {
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          addOrderBy: jest.fn().mockReturnThis(),
          ...overrides,
        };
        for (const key of Object.keys(query)) {
          if (!overrides[key]) {
            query[key].mockReturnValue(query);
          }
        }
        return query;
      };

      const entityManager = {
        findOne: jest.fn().mockResolvedValue(profile),
        count: jest.fn().mockResolvedValue(1),
        create: jest
          .fn()
          .mockImplementation((_entity: unknown, data: unknown) => data),
        save: jest.fn().mockResolvedValue([]),
        createQueryBuilder: jest.fn(),
      };

      const skillQuery = makeQuery({
        getOne: jest.fn().mockResolvedValue({
          percentage: 45,
          claimed_percentage: 45,
        }),
      });
      const activeAttemptQuery = makeQuery({
        getOne: jest.fn().mockResolvedValue(null),
      });
      const questionQuery = makeQuery({
        getMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue({ max: '30' }),
      });
      entityManager.createQueryBuilder.mockImplementation((entity) => {
        if (entity === AssessmentResult) return skillQuery;
        if (entity === AssessmentAttempt) return activeAttemptQuery;
        return questionQuery;
      });

      questionGeneration.generateQuestions = jest.fn().mockResolvedValue([]);
      advancedAssessmentAiService.generateQuestions.mockReturnValue({
        context: { verified_level: VerifiedLevel.MID },
        questions: makeSessionJson().questions.slice(0, 10),
      });

      talentProfileRepo.manager.transaction.mockImplementation(
        (work: (em: typeof entityManager) => Promise<unknown>) =>
          work(entityManager),
      );

      await expect(service.start(userId)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws 503 BANK_EXHAUSTED when fewer than 19 base questions can be assembled', async () => {
      const profile = makeTalentProfile({
        validated_level: VerifiedLevel.MID,
        personal_assessment_completed_at: new Date(),
        assessment_locked_until: null,
      });

      const makeQuery = (overrides: Record<string, jest.Mock> = {}) => {
        const query: Record<string, jest.Mock> = {
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          addOrderBy: jest.fn().mockReturnThis(),
          ...overrides,
        };
        for (const key of Object.keys(query)) {
          if (!overrides[key]) {
            query[key].mockReturnValue(query);
          }
        }
        return query;
      };

      const entityManager = {
        findOne: jest.fn().mockResolvedValue(profile),
        count: jest.fn().mockResolvedValue(1),
        create: jest
          .fn()
          .mockImplementation((_entity: unknown, data: unknown) => data),
        save: jest.fn().mockResolvedValue([]),
        createQueryBuilder: jest.fn(),
      };

      const skillQuery = makeQuery({
        getOne: jest.fn().mockResolvedValue({
          percentage: 80,
        }),
      });
      const activeAttemptQuery = makeQuery({
        getOne: jest.fn().mockResolvedValue(null),
      });
      const questionQuery = makeQuery({
        getMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue({ max: '30' }),
      });
      entityManager.createQueryBuilder.mockImplementation((entity) => {
        if (entity === AssessmentResult) return skillQuery;
        if (entity === AssessmentAttempt) return activeAttemptQuery;
        return questionQuery;
      });

      questionGeneration.generateQuestions = jest.fn().mockResolvedValue([]);
      advancedAssessmentAiService.generateQuestions.mockReturnValue({
        context: { verified_level: VerifiedLevel.MID },
        questions: makeSessionJson().questions.slice(0, 10),
      });

      talentProfileRepo.manager.transaction.mockImplementation(
        (work: (em: typeof entityManager) => Promise<unknown>) =>
          work(entityManager),
      );

      await expect(service.start(userId)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
