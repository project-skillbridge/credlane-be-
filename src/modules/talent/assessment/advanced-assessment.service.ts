import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Not, Repository } from 'typeorm';
import {
  AssessmentAttempt,
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentResult,
  AssessmentScore,
  AssessmentScoreQuestionType,
  AssessmentType,
  IntegrityConfidenceLevel,
  QuestionType,
  SlotType,
  TalentQuestionHistory,
} from '../../assessments/entities';
import { AssessmentTier } from '../../assessments/entities/assessment-result.entity';
import { ErrorMessages, SuccessMessages } from '../../../shared';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../entities/talent-profile.entity';
import { VerifiedLevel } from '../../assessments/entities/assessment-question.entity';
import {
  ADVANCED_ASSESSMENT_BASE_QUESTIONS,
  ADVANCED_ASSESSMENT_MCQ_COUNT,
  ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT,
  AdvancedAssessmentAiService,
  AdvancedAssessmentGeneratedQuestion,
  blockLengthLimits,
} from './advanced-assessment-ai.service';
import { PersonalAssessmentService } from './personal-assessment.service';
import { RubricScoringService } from '../../ai/rubric-scoring.service';
import { GuidanceReportService } from '../../ai/guidance-report.service';
import { Lt3GenerationService } from '../../ai/lt3-generation.service';
import { EmployerPoolProfileService } from './employer-pool-profile.service';
import {
  GenerateQuestionsInput,
  GeneratedQuestion,
  GuidanceReport,
  QuestionGradingRubric,
  ScoredTextAnswer,
  TextAnswerInput,
} from '../../ai/ai.types';
import { QuestionGenerationService } from '../../ai/question-generation.service';
import { NotificationDispatchService } from '../../notifications/notification-dispatch.service';
import { NotificationType } from '../../notifications/notification-type.enum';
import { UsersService } from '../../users/users.service';
import {
  FlagIntegrityEventDto,
  IntegrityEventType,
  SubmitAdvancedAssessmentDto,
  SubmitLt2Dto,
} from './dto/advanced-assessment.dto';
import { IntegrityFlagResult } from './dto/integrity-event.dto';
import {
  metadataDifficulty,
  resolveCompetencyHint,
  resolveIndustryContext,
} from './assessment-utils';
import {
  competenciesForTrack,
  normaliseCompetency,
  sanitiseCompetencyList,
} from './competency-taxonomy';

const ADVANCED_ASSESSMENT_DURATION_MINUTES = 90;
const RETAKE_GATE_DAYS = 14;
const ABNORMAL_LONG_TEXT_SECONDS = 5;
const ADVANCED_SHORT_TEXT_MIN_CHARS = 10;
const ADVANCED_SHORT_TEXT_MAX_CHARS = 600;
const ADVANCED_LONG_TEXT_MIN_CHARS = 60;
const ADVANCED_LONG_TEXT_MAX_CHARS = 2000;

// Long-text block = 2 situational (LT-1) + 2 work-task (LT-2) + 1 reflection
// (LT-3). LT-3 is runtime-generated, served via /lt2-submit, not pre-selected
// here.
const ADVANCED_LT1_COUNT = 2;
const ADVANCED_LT2_COUNT = 2;

// Scoring totals:
//   MCQ × 10 (1 pt each)             =  10
//   Short text × 10 (max 12 each)    = 120
//   LT-1 + LT-2 × 4 (max 12 each)    =  48
//   LT-3 × 1 (max 8)                 =   8
//   TOTAL                            = 186
const TEXT_FULL_RUBRIC_MAX = 12;
const LT3_RUBRIC_MAX = 8;

export interface AdvancedAssessmentSessionResult {
  status: string;
  message: string;
  session_id: string;
  started_at: string;
  expires_at: string;
  completed_at: string | null;
  is_expired: boolean;
  remaining_seconds: number;
  verified_level: string;
  question_count: number;
  questions: AdvancedAssessmentGeneratedQuestion[];
}

export interface AdvancedAssessmentSubmitResult {
  status: string;
  message: string;
  session_id: string;
  score: number;
  max_score: number;
  percentage: number;
  tier: AssessmentTier;
  integrity_confidence: string;
  guidance_report?: GuidanceReport;
  auto_submitted?: boolean;
}

export interface SubmitLt2Result {
  status: string;
  message: string;
  session_id: string;
  question_id: string;
  question_number: number;
  question_text: string;
  max_seconds_remaining: number;
}

type AdvancedAssessmentSessionPayload = {
  context?: {
    verified_level?: unknown;
  };
  questions?: unknown;
};

type AdvancedQuestionBank = {
  mcq: AssessmentQuestion[];
  shortText: AssessmentQuestion[];
  longText: AssessmentQuestion[];
};

@Injectable()
export class AdvancedAssessmentService {
  private readonly logger = new Logger(AdvancedAssessmentService.name);

  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepo: Repository<TalentProfile>,

    @InjectRepository(AssessmentQuestion)
    private readonly questionRepo: Repository<AssessmentQuestion>,

    @InjectRepository(AssessmentAttempt)
    private readonly attemptRepo: Repository<AssessmentAttempt>,

    @InjectRepository(AssessmentResult)
    private readonly resultRepo: Repository<AssessmentResult>,

    private readonly personalAssessmentService: PersonalAssessmentService,
    private readonly advancedAssessmentAiService: AdvancedAssessmentAiService,
    private readonly rubricScoring: RubricScoringService,
    private readonly guidanceReport: GuidanceReportService,
    private readonly lt3Generation: Lt3GenerationService,
    private readonly employerPoolProfileService: EmployerPoolProfileService,
    private readonly questionGeneration: QuestionGenerationService,
    private readonly usersService: UsersService,
    private readonly notificationDispatch: NotificationDispatchService,
  ) {}

  async start(userId: string): Promise<AdvancedAssessmentSessionResult> {
    const personalContext =
      await this.personalAssessmentService.getAiContext(userId);

    const savedAttempt = await this.talentProfileRepo.manager.transaction(
      async (manager) => {
        const profile = await manager.findOne(TalentProfile, {
          where: { user_id: userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!profile) {
          throw new NotFoundException(
            ErrorMessages.ADVANCED_ASSESSMENT.PROFILE_NOT_FOUND,
          );
        }

        if (!profile.personal_assessment_completed_at) {
          throw new UnprocessableEntityException(
            ErrorMessages.ADVANCED_ASSESSMENT.PERSONAL_ASSESSMENT_INCOMPLETE,
          );
        }

        if (!profile.validated_level) {
          throw new UnprocessableEntityException({
            error: 'LEVEL_NOT_VERIFIED',
            message: ErrorMessages.ADVANCED_ASSESSMENT.LEVEL_NOT_VERIFIED,
          });
        }

        const completedSkillAttempts = await manager.count(AssessmentAttempt, {
          where: {
            talent_profile_id: profile.id,
            assessment_type: AssessmentType.SKILL,
            completed_at: Not(IsNull()),
          },
        });
        if (completedSkillAttempts < 1) {
          throw new UnprocessableEntityException(
            ErrorMessages.ADVANCED_ASSESSMENT.SKILL_GATE_REQUIRED,
          );
        }

        const latestSkillResult = await this.findLatestSkillResult(
          manager,
          profile.id,
        );
        if (!latestSkillResult) {
          throw new UnprocessableEntityException(
            ErrorMessages.ADVANCED_ASSESSMENT.SKILL_GATE_REQUIRED,
          );
        }

        this.assertAdvancedRetakeUnlocked(profile);

        const activeAttempt = await manager
          .createQueryBuilder(AssessmentAttempt, 'attempt')
          .where('attempt.talent_profile_id = :talentProfileId', {
            talentProfileId: profile.id,
          })
          .andWhere('attempt.assessment_type = :assessmentType', {
            assessmentType: AssessmentType.ADVANCED,
          })
          .andWhere('attempt.completed_at IS NULL')
          .andWhere('attempt.force_submitted = false')
          .andWhere(
            '(attempt.expires_at IS NULL OR attempt.expires_at > :now)',
            { now: new Date() },
          )
          .orderBy('attempt.started_at', 'DESC')
          .getOne();

        if (activeAttempt) {
          throw new ConflictException({
            error: 'CONFLICT',
            message: ErrorMessages.ADVANCED_ASSESSMENT.ACTIVE_SESSION_EXISTS,
            existing_session_id: activeAttempt.id,
          });
        }

        const eligibleQuestions = await this.findEligibleQuestions(
          manager,
          profile,
        );
        const selectedQuestions = await this.selectQuestionBlocks(
          manager,
          profile,
          personalContext,
          eligibleQuestions,
        );

        const aiResult = this.advancedAssessmentAiService.generateQuestions(
          {
            ...personalContext,
            track: profile.track,
            verified_level: profile.validated_level,
          },
          selectedQuestions,
        );

        if (aiResult.questions.length !== ADVANCED_ASSESSMENT_BASE_QUESTIONS) {
          this.logger.error(
            `[BANK_EXHAUSTED] expected=${ADVANCED_ASSESSMENT_BASE_QUESTIONS} ` +
              `got=${aiResult.questions.length} ` +
              `talentProfileId=${profile.id} ` +
              `track=${profile.track ?? 'unknown'} ` +
              `verified_level=${profile.validated_level ?? 'unknown'}`,
          );
          throw new ServiceUnavailableException({
            error: 'BANK_EXHAUSTED',
            message: ErrorMessages.ADVANCED_ASSESSMENT.BANK_EXHAUSTED,
            track: profile.track ?? null,
            verified_level: profile.validated_level ?? null,
            expected_questions: ADVANCED_ASSESSMENT_BASE_QUESTIONS,
            got_questions: aiResult.questions.length,
          });
        }

        const startedAt = new Date();
        const expiresAt = new Date(
          startedAt.getTime() +
            ADVANCED_ASSESSMENT_DURATION_MINUTES * 60 * 1000,
        );

        const attempt = await manager.save(
          AssessmentAttempt,
          manager.create(AssessmentAttempt, {
            talent_profile_id: profile.id,
            assessment_type: AssessmentType.ADVANCED,
            started_at: startedAt,
            completed_at: null,
            expires_at: expiresAt,
            generated_questions_json: {
              context: aiResult.context,
              questions: aiResult.questions,
            },
          }),
        );

        await manager.save(
          TalentQuestionHistory,
          aiResult.questions.map((question) =>
            manager.create(TalentQuestionHistory, {
              talent_profile_id: profile.id,
              question_id: question.question_id,
              attempt_id: attempt.id,
              user_answer: { served: true },
              is_correct: null,
              raw_score: null,
              max_score: null,
              answered_at: startedAt,
            }),
          ),
        );

        return attempt;
      },
    );

    this.logger.log(
      `Advanced assessment started: attempt=${savedAttempt.id} user=${userId}`,
    );

    return this.toSessionResult(
      savedAttempt,
      SuccessMessages.ADVANCED_ASSESSMENT.STARTED,
    );
  }

  async getSession(
    userId: string,
    sessionId: string,
  ): Promise<AdvancedAssessmentSessionResult> {
    const profile = await this.talentProfileRepo.findOne({
      where: { user_id: userId },
    });
    if (!profile) {
      throw new NotFoundException(
        ErrorMessages.ADVANCED_ASSESSMENT.PROFILE_NOT_FOUND,
      );
    }
    this.assertAdvancedRetakeUnlocked(profile);

    const attempt = await this.attemptRepo.findOne({
      where: {
        id: sessionId,
        talent_profile_id: profile.id,
        assessment_type: AssessmentType.ADVANCED,
      },
    });
    if (!attempt) {
      throw new NotFoundException(
        ErrorMessages.ADVANCED_ASSESSMENT.SESSION_NOT_FOUND,
      );
    }

    return this.toSessionResult(
      attempt,
      SuccessMessages.ADVANCED_ASSESSMENT.SESSION_RESUMED,
    );
  }

  async submit(
    userId: string,
    dto: SubmitAdvancedAssessmentDto,
  ): Promise<AdvancedAssessmentSubmitResult> {
    const profile = await this.talentProfileRepo.findOne({
      where: { user_id: userId },
    });
    if (!profile) {
      throw new NotFoundException(
        ErrorMessages.ADVANCED_ASSESSMENT.PROFILE_NOT_FOUND,
      );
    }
    this.assertAdvancedRetakeUnlocked(profile);

    const attempt = await this.attemptRepo.findOne({
      where: {
        id: dto.session_id,
        talent_profile_id: profile.id,
        assessment_type: AssessmentType.ADVANCED,
      },
    });
    if (!attempt) {
      throw new NotFoundException(
        ErrorMessages.ADVANCED_ASSESSMENT.ATTEMPT_NOT_FOUND,
      );
    }
    if (attempt.completed_at) {
      throw new BadRequestException(
        ErrorMessages.ADVANCED_ASSESSMENT.ATTEMPT_ALREADY_SUBMITTED,
      );
    }
    if (attempt.force_submitted) {
      throw new BadRequestException(
        ErrorMessages.ADVANCED_ASSESSMENT.SESSION_VOIDED,
      );
    }

    const isExpired = attempt.expires_at
      ? attempt.expires_at <= new Date()
      : false;

    const sessionQuestions = this.readSessionQuestions(attempt);
    if (sessionQuestions.length === 0) {
      throw new BadRequestException(
        ErrorMessages.ADVANCED_ASSESSMENT.SESSION_CORRUPT,
      );
    }

    // LT-3 must be present in the session payload before final submission.
    // It only gets there via POST /lt2-submit. If the client tried to skip
    // it, refuse — partial scoring would silently count LT-3 as 0/8 and
    // contaminate the tier.
    const hasReflectionSlot = sessionQuestions.some(
      (question) => question.slot_type === SlotType.REFLECTION,
    );
    if (!hasReflectionSlot) {
      throw new UnprocessableEntityException({
        error: 'LT2_NOT_SUBMITTED',
        message: ErrorMessages.ADVANCED_ASSESSMENT.LT2_NOT_SUBMITTED,
      });
    }

    const answerMap = new Map(
      dto.answers.map((answer) => [answer.question_id, answer]),
    );

    let mcqRawScore = 0;
    let mcqTotal = 0;
    const textInputs: TextAnswerInput[] = [];
    const responsesToSave: Partial<AssessmentResponse>[] = [];
    // Map keyed by question_id so each text answer scored by the AI rubric
    // can be associated back to its question for assessment_scores writes.
    const abnormalTimingByQuestion = new Map<string, boolean>();
    let hasAbnormalTiming = false;

    for (const question of sessionQuestions) {
      const submitted = answerMap.get(question.question_id);
      const isMcq =
        question.question_type === QuestionType.SINGLE_PICK ||
        question.question_type === QuestionType.MULTI_PICK;

      if (isMcq) {
        mcqTotal++;
        const correct = this.scoreMcq(question, submitted?.answer ?? null);
        mcqRawScore += correct ? 1 : 0;
        responsesToSave.push({
          attempt_id: attempt.id,
          question_id: question.question_id,
          question_text: question.question_text,
          user_answer: submitted?.answer ?? '',
          is_correct: correct,
          ai_evaluation_json: null,
          answered_at: new Date(),
        });
        continue;
      }

      const answer = submitted ? String(submitted.answer) : '';
      this.assertTextLength(question, answer);

      const isLongText = question.block === 'long_text';
      const abnormal =
        isLongText &&
        submitted?.time_spent_seconds !== undefined &&
        submitted.time_spent_seconds < ABNORMAL_LONG_TEXT_SECONDS &&
        answer.length > 0;
      if (abnormal) {
        hasAbnormalTiming = true;
        abnormalTimingByQuestion.set(question.question_id, true);
      }

      const metadata = (question.metadata ?? {}) as Record<string, unknown>;
      const rawRubric = metadata.grading_rubric;
      const gradingRubric =
        rawRubric !== null &&
        typeof rawRubric === 'object' &&
        !Array.isArray(rawRubric)
          ? (rawRubric as QuestionGradingRubric)
          : null;

      textInputs.push({
        question_id: question.question_id,
        question_text: question.question_text,
        answer,
        grading_rubric: gradingRubric,
        is_lt3: question.slot_type === SlotType.REFLECTION,
      });
      responsesToSave.push({
        attempt_id: attempt.id,
        question_id: question.question_id,
        question_text: question.question_text,
        user_answer: answer,
        is_correct: null,
        ai_evaluation_json: null,
        answered_at: new Date(),
      });
    }

    const scoredTextAnswers = await this.rubricScoring.scoreAnswers(textInputs);

    let textRawScore = 0;
    let textMaxScore = 0;
    const scoredByQuestion = new Map<string, ScoredTextAnswer>();
    for (const scored of scoredTextAnswers) {
      textRawScore += scored.raw_score;
      textMaxScore += scored.max_score;
      scoredByQuestion.set(scored.question_id, scored);

      const response = responsesToSave.find(
        (entry) => entry.question_id === scored.question_id,
      );
      if (response) {
        response.ai_evaluation_json = { ...scored.rubric };
      }
    }

    const totalRawScore = mcqRawScore + textRawScore;
    // MCQ contributes 1 pt per question (10 max); text contributes the
    // rubric's max_score per question (12 for short/LT-1/LT-2, 8 for LT-3).
    const maxScore = Math.round(ADVANCED_ASSESSMENT_MCQ_COUNT + textMaxScore);
    const percentage =
      maxScore > 0 ? Math.round((totalRawScore / maxScore) * 100) : 0;

    const mcqGatePassed = mcqTotal === 0 || mcqRawScore > 0;
    if (mcqTotal === 0) {
      this.logger.warn(
        `Advanced assessment MCQ gate bypassed: no MCQs attempt=${attempt.id} user=${userId}`,
      );
    }

    const tier = this.resolveTier(percentage, mcqGatePassed);
    const integrityConfidence = this.resolveIntegrityConfidence(
      attempt.tab_switch_count,
      attempt.copy_paste_count ?? 0,
      hasAbnormalTiming,
    );

    // Pull real competency labels from the question metadata before they
    // flow into the guidance prompt and the employer pool profile.
    const strongCompetencies = this.extractCompetencies(
      sessionQuestions,
      scoredTextAnswers,
      profile.track,
      'strong',
    );
    const weakCompetencies = this.extractCompetencies(
      sessionQuestions,
      scoredTextAnswers,
      profile.track,
      'weak',
    );

    const guidanceInput = {
      report_type: tier === AssessmentTier.JOB_READY ? 'job_ready' : 'emerging',
      track: profile.track ?? 'general',
      claimed_level: profile.claimed_level ?? VerifiedLevel.JUNIOR,
      validated_level: profile.validated_level ?? VerifiedLevel.JUNIOR,
      percentage,
      strong_competencies: strongCompetencies,
      weak_competencies: weakCompetencies,
    } satisfies Parameters<GuidanceReportService['generate']>[0];

    const personalContext =
      tier === AssessmentTier.JOB_READY
        ? await this.personalAssessmentService.getAiContext(userId)
        : null;

    let resultLookup: { id: string } | { attempt_id: string } | null = null;

    await this.talentProfileRepo.manager.transaction(async (manager) => {
      await manager.save(AssessmentResponse, responsesToSave);

      // Write one assessment_scores row per session question.
      const scoreRows = this.buildAssessmentScoreRows({
        attempt,
        talentProfileId: profile.id,
        sessionQuestions,
        scoredByQuestion,
        abnormalTimingByQuestion,
        integrityConfidence,
        answerMap,
      });
      if (scoreRows.length > 0) {
        await manager.save(AssessmentScore, scoreRows);
      }

      attempt.completed_at = new Date();
      await manager.save(AssessmentAttempt, attempt);

      const result = manager.create(AssessmentResult, {
        attempt_id: attempt.id,
        score: Math.round(totalRawScore),
        max_score: maxScore,
        percentage,
        tier,
        validated_level: null,
        guidance_report: null,
        integrity_confidence: integrityConfidence,
      });
      const savedResult = await manager.save(AssessmentResult, result);
      resultLookup = savedResult.id
        ? { id: savedResult.id }
        : { attempt_id: attempt.id };

      const profilePatch: Partial<TalentProfile> = {
        advanced_assessment_completed_at: new Date(),
        status: this.tierToProfileStatus(tier),
      };

      if (tier !== AssessmentTier.JOB_READY) {
        const lockedFrom = new Date();
        const unlocksAt = new Date(lockedFrom);
        unlocksAt.setDate(unlocksAt.getDate() + RETAKE_GATE_DAYS);
        profilePatch.assessment_locked_from = lockedFrom;
        profilePatch.assessment_locked_until = unlocksAt;
        profilePatch.advanced_retake_required = true;
      } else {
        profilePatch.assessment_locked_from = null;
        profilePatch.assessment_locked_until = null;
        profilePatch.advanced_retake_required = false;
      }

      await manager.update(TalentProfile, { id: profile.id }, profilePatch);
    });

    if (resultLookup) {
      this.generateGuidanceReportAsync(resultLookup, guidanceInput);
    }

    if (tier === AssessmentTier.JOB_READY && personalContext) {
      try {
        const competencyByQuestion = new Map<string, string | null>();
        for (const question of sessionQuestions) {
          const metadata = (question.metadata ?? {}) as Record<string, unknown>;
          const competency =
            typeof metadata.competency === 'string'
              ? metadata.competency.toLowerCase()
              : null;
          competencyByQuestion.set(question.question_id, competency);
        }

        await this.employerPoolProfileService.upsert({
          profile,
          userId,
          score: Math.round(totalRawScore),
          tier,
          percentage,
          scoredTextAnswers,
          competencyByQuestion,
          integrityClean: integrityConfidence === 'high',
          personalContext,
        });
      } catch (error) {
        this.logger.error(
          `Employer pool profile generation failed for user=${userId}: ${String(error)}`,
        );
      }
    }

    this.logger.log(
      `Advanced assessment submitted: attempt=${attempt.id} user=${userId} score=${totalRawScore}/${maxScore} (${percentage}%) tier=${tier} expired=${isExpired}`,
    );

    void this.notificationDispatch.dispatch(
      NotificationType.ADVANCED_ASSESSMENT_SCORE_READY,
      userId,
      {
        score: Math.round(totalRawScore),
        maxScore,
        percentage,
        tier,
      },
    );

    return {
      status: 'success',
      message: SuccessMessages.ADVANCED_ASSESSMENT.SUBMITTED,
      session_id: attempt.id,
      score: Math.round(totalRawScore),
      max_score: maxScore,
      percentage,
      tier,
      integrity_confidence: integrityConfidence,
      ...(isExpired && { auto_submitted: true }),
    };
  }

  private generateGuidanceReportAsync(
    resultLookup: { id: string } | { attempt_id: string },
    input: Parameters<GuidanceReportService['generate']>[0],
  ): void {
    void this.guidanceReport
      .generate(input)
      .then((guidanceReport) =>
        this.resultRepo.update(resultLookup, {
          guidance_report: { ...guidanceReport },
        }),
      )
      .catch((error) => {
        this.logger.warn(`Guidance report generation failed: ${String(error)}`);
      });
  }

  /**
   * Generate LT-3 from the candidate's LT-2 answer and append it to the
   * session payload. Idempotent: a repeated call returns the LT-3 that was
   * generated on the first call without invoking the LLM again.
   */
  async submitLt2(
    userId: string,
    sessionId: string,
    dto: SubmitLt2Dto,
  ): Promise<SubmitLt2Result> {
    const profile = await this.talentProfileRepo.findOne({
      where: { user_id: userId },
    });
    if (!profile) {
      throw new NotFoundException(
        ErrorMessages.ADVANCED_ASSESSMENT.PROFILE_NOT_FOUND,
      );
    }
    this.assertAdvancedRetakeUnlocked(profile);

    const attempt = await this.attemptRepo.findOne({
      where: {
        id: sessionId,
        talent_profile_id: profile.id,
        assessment_type: AssessmentType.ADVANCED,
      },
    });
    if (!attempt) {
      throw new NotFoundException(
        ErrorMessages.ADVANCED_ASSESSMENT.ATTEMPT_NOT_FOUND,
      );
    }
    if (attempt.completed_at) {
      throw new BadRequestException(
        ErrorMessages.ADVANCED_ASSESSMENT.ATTEMPT_ALREADY_SUBMITTED,
      );
    }
    if (attempt.force_submitted) {
      throw new BadRequestException(
        ErrorMessages.ADVANCED_ASSESSMENT.SESSION_VOIDED,
      );
    }
    if (attempt.expires_at && attempt.expires_at <= new Date()) {
      throw new UnprocessableEntityException(
        ErrorMessages.ADVANCED_ASSESSMENT.SESSION_EXPIRED,
      );
    }

    const sessionQuestions = this.readSessionQuestions(attempt);
    if (sessionQuestions.length === 0) {
      throw new BadRequestException(
        ErrorMessages.ADVANCED_ASSESSMENT.SESSION_CORRUPT,
      );
    }

    // Locate the LT-2 (last WORK_TASK long-text) and confirm the client posted
    // an answer for the right question_id.
    const workTaskQuestions = sessionQuestions.filter(
      (question) =>
        question.block === 'long_text' &&
        question.slot_type === SlotType.WORK_TASK,
    );
    const lt2Question = workTaskQuestions[workTaskQuestions.length - 1];
    if (!lt2Question) {
      throw new BadRequestException(
        ErrorMessages.ADVANCED_ASSESSMENT.SESSION_CORRUPT,
      );
    }
    if (lt2Question.question_id !== dto.question_id) {
      throw new UnprocessableEntityException({
        error: 'LT2_QUESTION_MISMATCH',
        message: ErrorMessages.ADVANCED_ASSESSMENT.LT2_QUESTION_MISMATCH,
      });
    }

    // Idempotency: if LT-3 has already been generated for this attempt,
    // return it as-is. Prevents flaky-connection retries from spawning
    // a different reflection question.
    const existingLt3 = sessionQuestions.find(
      (question) => question.slot_type === SlotType.REFLECTION,
    );
    if (existingLt3) {
      this.logger.log(
        `LT-3 already generated for attempt=${attempt.id}; returning existing.`,
      );
      return {
        status: 'success',
        message: SuccessMessages.ADVANCED_ASSESSMENT.LT2_SUBMITTED,
        session_id: attempt.id,
        question_id: existingLt3.question_id,
        question_number: existingLt3.question_number,
        question_text: existingLt3.question_text,
        max_seconds_remaining: this.remainingSeconds(attempt),
      };
    }

    const verifiedLevel = profile.validated_level ?? VerifiedLevel.JUNIOR;
    const track = profile.track ?? 'general';

    let generatedLt3Text: string;
    try {
      const generated = await this.lt3Generation.generate({
        track,
        verified_level: verifiedLevel,
        lt2_question_text: lt2Question.question_text,
        lt2_answer: dto.answer,
      });
      generatedLt3Text = generated.question_text;
    } catch (error) {
      this.logger.error(
        `LT-3 generation failed for attempt=${attempt.id}: ${String(error)}`,
      );
      throw new ServiceUnavailableException({
        error: 'LT3_GENERATION_FAILED',
        message: ErrorMessages.ADVANCED_ASSESSMENT.LT3_GENERATION_FAILED,
      });
    }

    const nextQuestionNumber = sessionQuestions.length + 1;
    const result = await this.talentProfileRepo.manager.transaction(
      async (manager) => {
        // Persist a stable AssessmentQuestion row for the runtime LT-3 so it
        // has a UUID we can use in responses + score rows + history.
        const lt3Question = await manager.save(
          AssessmentQuestion,
          manager.create(AssessmentQuestion, {
            assessment_type: AssessmentType.ADVANCED,
            question_type: QuestionType.OPTIONAL_TEXT,
            question_text: generatedLt3Text,
            question_number: nextQuestionNumber,
            options: null,
            correct_answer: null,
            track,
            verified_level: verifiedLevel,
            competency: normaliseCompetency(track, null),
            slot_type: SlotType.REFLECTION,
            // CHK_assessment_questions_metadata_valid requires difficulty,
            // estimated_time_seconds, and a tags array. We extend the base
            // generated-question metadata with the LT-2 linkage for audit.
            metadata: {
              ...this.buildGeneratedQuestionMetadata({
                track,
                verifiedLevel,
                questionType: QuestionType.OPTIONAL_TEXT,
                competency: null,
                slotType: SlotType.REFLECTION,
                block: 'long_text',
                industryContext: null,
              }),
              lt3_runtime: true,
              lt2_question_id: lt2Question.question_id,
            },
            is_live: false,
          }),
        );

        // Block this specific LT-3 question from ever being re-served.
        await manager.save(
          TalentQuestionHistory,
          manager.create(TalentQuestionHistory, {
            talent_profile_id: profile.id,
            question_id: lt3Question.id,
            attempt_id: attempt.id,
            user_answer: { lt3_runtime: true },
            is_correct: null,
            raw_score: null,
            max_score: null,
            answered_at: new Date(),
          }),
        );

        // Append LT-3 to the session jsonb so subsequent /session/:id reads
        // and the final /advanced/submit see all 25 questions. Mirror the
        // exact metadata we just persisted so the session view and the DB
        // row stay in sync.
        const updatedQuestions: AdvancedAssessmentGeneratedQuestion[] = [
          ...sessionQuestions,
          {
            question_id: lt3Question.id,
            question_number: nextQuestionNumber,
            block: 'long_text',
            question_type: QuestionType.OPTIONAL_TEXT,
            question_text: generatedLt3Text,
            options: null,
            slot_type: SlotType.REFLECTION,
            metadata: lt3Question.metadata as Record<string, unknown>,
            correct_answer: null,
            ...blockLengthLimits('long_text'),
          },
        ];

        const payload = this.readSessionPayload(attempt);
        const updatedJson = { ...payload, questions: updatedQuestions };
        await manager.update(AssessmentAttempt, { id: attempt.id }, {
          generated_questions_json: updatedJson as unknown as Record<string, any>,
        });
        attempt.generated_questions_json = updatedJson;

        return lt3Question;
      },
    );

    this.logger.log(
      `LT-3 generated: attempt=${attempt.id} user=${userId} lt3=${result.id}`,
    );

    return {
      status: 'success',
      message: SuccessMessages.ADVANCED_ASSESSMENT.LT2_SUBMITTED,
      session_id: attempt.id,
      question_id: result.id,
      question_number: nextQuestionNumber,
      question_text: generatedLt3Text,
      max_seconds_remaining: this.remainingSeconds(attempt),
    };
  }

  async flag(
    userId: string,
    sessionId: string,
    dto: FlagIntegrityEventDto,
  ): Promise<IntegrityFlagResult> {
    const profile = await this.talentProfileRepo.findOne({
      where: { user_id: userId },
    });
    if (!profile) {
      throw new NotFoundException(
        ErrorMessages.ADVANCED_ASSESSMENT.PROFILE_NOT_FOUND,
      );
    }

    const counterField =
      dto.event_type === IntegrityEventType.TAB_SWITCH
        ? 'tab_switch_count'
        : 'copy_paste_count';

    const result = await this.talentProfileRepo.manager.transaction(
      async (manager) => {
        const attempt = await manager.findOne(AssessmentAttempt, {
          where: {
            id: sessionId,
            talent_profile_id: profile.id,
            assessment_type: AssessmentType.ADVANCED,
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (!attempt) {
          throw new NotFoundException(
            ErrorMessages.ADVANCED_ASSESSMENT.ATTEMPT_NOT_FOUND,
          );
        }
        if (attempt.completed_at || attempt.force_submitted) {
          throw new BadRequestException(
            ErrorMessages.ADVANCED_ASSESSMENT.ATTEMPT_ALREADY_SUBMITTED,
          );
        }

        await manager.increment(
          AssessmentAttempt,
          {
            id: attempt.id,
            talent_profile_id: profile.id,
            assessment_type: AssessmentType.ADVANCED,
          },
          counterField,
          1,
        );

        const updatedAttempt = await manager.findOne(AssessmentAttempt, {
          where: { id: attempt.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!updatedAttempt) {
          throw new NotFoundException(
            ErrorMessages.ADVANCED_ASSESSMENT.ATTEMPT_NOT_FOUND,
          );
        }

        const lockedFrom = new Date();
        const unlocksAt = new Date(lockedFrom);
        unlocksAt.setDate(unlocksAt.getDate() + RETAKE_GATE_DAYS);

        await manager.update(
          AssessmentAttempt,
          { id: attempt.id },
          { force_submitted: true, completed_at: new Date() },
        );
        await manager.update(
          TalentProfile,
          { id: profile.id },
          {
            assessment_locked_from: lockedFrom,
            assessment_locked_until: unlocksAt,
            advanced_retake_required: true,
          },
        );

        return {
          attemptId: attempt.id,
          tabSwitchCount: updatedAttempt.tab_switch_count,
          copyPasteCount: updatedAttempt.copy_paste_count,
        };
      },
    );

    this.logger.warn(
      `Session voided - integrity ${dto.event_type}: attempt=${result.attemptId} user=${userId}`,
    );

    return {
      status: 'voided',
      message: ErrorMessages.ADVANCED_ASSESSMENT.SESSION_VOIDED,
      tab_switch_count: result.tabSwitchCount,
      copy_paste_count: result.copyPasteCount,
      session_voided: true,
      action: 'logout',
    };
  }

  private scoreMcq(
    question: AdvancedAssessmentGeneratedQuestion,
    answer: string | string[] | null,
  ): boolean {
    if (!answer || !question.correct_answer) {
      return false;
    }

    const userAnswer = Array.isArray(answer)
      ? answer.join(',').toLowerCase().trim()
      : String(answer).toLowerCase().trim();
    const correctAnswer = String(question.correct_answer).toLowerCase().trim();

    return userAnswer === correctAnswer;
  }

  private resolveTier(
    percentage: number,
    mcqGatePassed = true,
  ): AssessmentTier {
    if (percentage >= 75 && mcqGatePassed) return AssessmentTier.JOB_READY;
    return AssessmentTier.EMERGING;
  }

  private tierToProfileStatus(tier: AssessmentTier): TalentProfileStatus {
    if (tier === AssessmentTier.JOB_READY) {
      return TalentProfileStatus.JOB_READY;
    }
    return TalentProfileStatus.EMERGING;
  }

  /**
   * Integrity confidence:
   *   abnormal long-text timing -> low
   *   any tab switch OR any copy-paste -> medium
   *   otherwise -> high
   */
  private resolveIntegrityConfidence(
    tabSwitchCount: number,
    copyPasteCount: number,
    hasAbnormalTiming: boolean,
  ): IntegrityConfidenceLevel {
    if (hasAbnormalTiming) return 'low';
    if (tabSwitchCount >= 1 || copyPasteCount >= 1) return 'medium';
    return 'high';
  }

  private assertAdvancedRetakeUnlocked(profile: TalentProfile): void {
    if (
      !profile.advanced_retake_required ||
      !profile.assessment_locked_until ||
      profile.assessment_locked_until <= new Date()
    ) {
      return;
    }

    throw new ForbiddenException(
      this.buildAdvancedRetakeLockedResponse(profile),
    );
  }

  private buildAdvancedRetakeLockedResponse(
    profile: TalentProfile,
  ): Record<string, unknown> {
    const probationEndsAt = profile.assessment_locked_until as Date;
    const probationStartedAt =
      profile.assessment_locked_from ??
      new Date(
        probationEndsAt.getTime() - RETAKE_GATE_DAYS * 24 * 60 * 60 * 1000,
      );

    return {
      error: 'ADVANCED_RETAKE_LOCKED',
      message: ErrorMessages.ADVANCED_ASSESSMENT.RETAKE_LOCKED(
        probationEndsAt.toISOString(),
      ),
      probation_started_at: probationStartedAt.toISOString(),
      probation_ends_at: probationEndsAt.toISOString(),
      remaining_seconds: Math.max(
        0,
        Math.ceil((probationEndsAt.getTime() - Date.now()) / 1000),
      ),
    };
  }

  /**
   * Pulls competency labels from the question metadata (track taxonomy)
   * for use in the guidance report. Strong = >=70% on the rubric, weak =
   * <50%. Dedupes + filters against the taxonomy for the candidate's track.
   */
  private extractCompetencies(
    sessionQuestions: AdvancedAssessmentGeneratedQuestion[],
    scored: ScoredTextAnswer[],
    track: string | null,
    band: 'strong' | 'weak',
  ): string[] {
    const competencyByQuestion = new Map<string, string | null>();
    for (const question of sessionQuestions) {
      const metadata = (question.metadata ?? {}) as Record<string, unknown>;
      const competency =
        typeof metadata.competency === 'string' ? metadata.competency : null;
      competencyByQuestion.set(question.question_id, competency);
    }

    const minRatio = band === 'strong' ? 0.7 : 0;
    const maxRatio = band === 'strong' ? 1.01 : 0.5;

    const raw: string[] = [];
    for (const score of scored) {
      if (score.max_score <= 0) continue;
      const ratio = score.raw_score / score.max_score;
      if (ratio < minRatio || ratio >= maxRatio) continue;
      const competency = competencyByQuestion.get(score.question_id);
      if (competency) raw.push(competency);
    }

    return sanitiseCompetencyList(track, raw);
  }

  /**
   * Builds one assessment_scores row per session question.
   * - MCQ rows: raw_score = 1 if correct else 0, max_score = 1, no rubric.
   * - Text rows: raw_score/max_score come from the rubric output.
   * - integrity_flag = true on a per-question basis when abnormal timing
   *   was detected on that specific text answer.
   * - integrity_confidence = the attempt-level confidence.
   */
  private buildAssessmentScoreRows(input: {
    attempt: AssessmentAttempt;
    talentProfileId: string;
    sessionQuestions: AdvancedAssessmentGeneratedQuestion[];
    scoredByQuestion: Map<string, ScoredTextAnswer>;
    abnormalTimingByQuestion: Map<string, boolean>;
    integrityConfidence: IntegrityConfidenceLevel;
    answerMap: Map<string, { answer: string | string[] }>;
  }): Partial<AssessmentScore>[] {
    const rows: Partial<AssessmentScore>[] = [];
    const {
      attempt,
      talentProfileId,
      sessionQuestions,
      scoredByQuestion,
      abnormalTimingByQuestion,
      integrityConfidence,
      answerMap,
    } = input;

    for (const question of sessionQuestions) {
      const metadata = (question.metadata ?? {}) as Record<string, unknown>;
      const competency =
        typeof metadata.competency === 'string' ? metadata.competency : null;
      const isMcq =
        question.question_type === QuestionType.SINGLE_PICK ||
        question.question_type === QuestionType.MULTI_PICK;

      if (isMcq) {
        const correct = this.scoreMcq(
          question,
          answerMap.get(question.question_id)?.answer ?? null,
        );
        rows.push({
          attempt_id: attempt.id,
          talent_profile_id: talentProfileId,
          question_id: question.question_id,
          question_type: AssessmentScoreQuestionType.MCQ,
          raw_score: correct ? 1 : 0,
          max_score: 1,
          pct_score: correct ? 100 : 0,
          competency,
          integrity_flag: false,
          integrity_confidence: integrityConfidence,
          ai_evaluation_json: null,
        });
        continue;
      }

      const scored = scoredByQuestion.get(question.question_id);
      const rawScore = scored?.raw_score ?? 0;
      const maxScore =
        scored?.max_score ??
        (question.slot_type === SlotType.REFLECTION
          ? LT3_RUBRIC_MAX
          : TEXT_FULL_RUBRIC_MAX);
      const pctScore = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;
      const integrityFlag =
        abnormalTimingByQuestion.get(question.question_id) === true;

      rows.push({
        attempt_id: attempt.id,
        talent_profile_id: talentProfileId,
        question_id: question.question_id,
        question_type:
          question.block === 'long_text'
            ? AssessmentScoreQuestionType.LONG_TEXT
            : AssessmentScoreQuestionType.SHORT_TEXT,
        raw_score: rawScore,
        max_score: maxScore,
        pct_score: Math.round(pctScore * 100) / 100,
        competency,
        integrity_flag: integrityFlag,
        integrity_confidence: integrityConfidence,
        ai_evaluation_json: scored?.rubric ? { ...scored.rubric } : null,
      });
    }

    return rows;
  }

  private remainingSeconds(attempt: AssessmentAttempt): number {
    if (!attempt.expires_at) return 0;
    return Math.max(
      0,
      Math.floor((attempt.expires_at.getTime() - Date.now()) / 1000),
    );
  }

  private assertTextLength(
    question: AdvancedAssessmentGeneratedQuestion,
    answer: string,
  ): void {
    const trimmed = answer.trim();
    if (!trimmed) {
      return;
    }

    if (question.block === 'short_text') {
      if (
        trimmed.length < ADVANCED_SHORT_TEXT_MIN_CHARS ||
        trimmed.length > ADVANCED_SHORT_TEXT_MAX_CHARS
      ) {
        throw new UnprocessableEntityException(
          `Question ${question.question_number} must be between ${ADVANCED_SHORT_TEXT_MIN_CHARS} and ${ADVANCED_SHORT_TEXT_MAX_CHARS} characters`,
        );
      }
      return;
    }

    if (
      trimmed.length < ADVANCED_LONG_TEXT_MIN_CHARS ||
      trimmed.length > ADVANCED_LONG_TEXT_MAX_CHARS
    ) {
      throw new UnprocessableEntityException(
        `Question ${question.question_number} must be between ${ADVANCED_LONG_TEXT_MIN_CHARS} and ${ADVANCED_LONG_TEXT_MAX_CHARS} characters`,
      );
    }
  }

  private async findLatestSkillResult(
    manager: EntityManager,
    talentProfileId: string,
  ): Promise<AssessmentResult | null> {
    return manager
      .createQueryBuilder(AssessmentResult, 'result')
      .innerJoin(AssessmentAttempt, 'attempt', 'attempt.id = result.attempt_id')
      .where('attempt.talent_profile_id = :talentProfileId', {
        talentProfileId,
      })
      .andWhere('attempt.assessment_type = :assessmentType', {
        assessmentType: AssessmentType.SKILL,
      })
      .orderBy('attempt.completed_at', 'DESC', 'NULLS LAST')
      .addOrderBy('result.created_at', 'DESC')
      .getOne();
  }

  private async findEligibleQuestions(
    manager: EntityManager,
    profile: TalentProfile,
  ): Promise<AssessmentQuestion[]> {
    const verifiedLevel = profile.validated_level ?? VerifiedLevel.JUNIOR;
    const track = profile.track ?? 'general';

    const primary = await manager
      .createQueryBuilder(AssessmentQuestion, 'question')
      .where('question.assessment_type = :assessmentType', {
        assessmentType: AssessmentType.ADVANCED,
      })
      .andWhere('question.is_live = true')
      .andWhere('question.track = :track', { track })
      .andWhere('question.verified_level = :verifiedLevel', { verifiedLevel })
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM talent_question_history history
          WHERE history.question_id = question.id
          AND history.talent_profile_id = :talentProfileId
        )`,
        { talentProfileId: profile.id },
      )
      .orderBy('RANDOM()')
      .getMany();

    if (primary.length > 0) {
      return primary;
    }

    return manager
      .createQueryBuilder(AssessmentQuestion, 'question')
      .where('question.assessment_type = :assessmentType', {
        assessmentType: AssessmentType.ADVANCED,
      })
      .andWhere('question.is_live = false')
      .andWhere('question.track = :track', { track })
      .andWhere('question.verified_level = :verifiedLevel', { verifiedLevel })
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM talent_question_history history
          WHERE history.question_id = question.id
          AND history.talent_profile_id = :talentProfileId
        )`,
        { talentProfileId: profile.id },
      )
      .orderBy('RANDOM()')
      .getMany();
  }

  private async selectQuestionBlocks(
    manager: EntityManager,
    profile: TalentProfile,
    personalContext: Record<string, unknown>,
    questions: AssessmentQuestion[],
  ): Promise<AdvancedQuestionBank> {
    const bankMcq = questions.filter((question) => this.isMcq(question));
    const bankText = questions.filter((question) => !this.isMcq(question));
    const bankShort = bankText.filter(
      (question) => this.textBlock(question) === 'short_text',
    );
    // Long-text base = 2 SITUATIONAL (LT-1) + 2 WORK_TASK (LT-2). LT-3
    // (REFLECTION) is runtime-generated by submitLt2() and never seeded
    // from the bank.
    const bankLongSituational = bankText.filter(
      (question) =>
        this.textBlock(question) === 'long_text' &&
        question.slot_type === SlotType.SITUATIONAL,
    );
    const bankLongWorkTask = bankText.filter(
      (question) =>
        this.textBlock(question) === 'long_text' &&
        question.slot_type === SlotType.WORK_TASK,
    );

    const mcq = [...bankMcq.slice(0, ADVANCED_ASSESSMENT_MCQ_COUNT)];
    const shortText = [
      ...bankShort.slice(0, ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT),
    ];
    const longSituational = [
      ...bankLongSituational.slice(0, ADVANCED_LT1_COUNT),
    ];
    const longWorkTask = [...bankLongWorkTask.slice(0, ADVANCED_LT2_COUNT)];

    const generatedQuestions: Array<
      GeneratedQuestion & { block: 'mcq' | 'short_text' | 'long_text' }
    > = [];
    const industryContext = resolveIndustryContext(personalContext);
    const competencyHint = resolveCompetencyHint(personalContext);
    const verifiedLevel = profile.validated_level ?? VerifiedLevel.JUNIOR;
    const track = profile.track ?? 'general';

    const mcqDeficit = ADVANCED_ASSESSMENT_MCQ_COUNT - mcq.length;
    if (mcqDeficit > 0) {
      const generated = await this.safeGenerateQuestions({
        track,
        verified_level: verifiedLevel,
        assessment_type: 'advanced',
        question_type: QuestionType.SINGLE_PICK,
        slot_type: SlotType.WORK_TASK,
        competency: competencyHint,
        industry_context: industryContext,
        count: mcqDeficit,
      });
      generatedQuestions.push(
        ...generated.map((question) => ({
          ...question,
          block: 'mcq' as const,
        })),
      );
    }

    const shortDeficit =
      ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT - shortText.length;
    if (shortDeficit > 0) {
      const generated = await this.safeGenerateQuestions({
        track,
        verified_level: verifiedLevel,
        assessment_type: 'advanced',
        question_type: QuestionType.REQUIRED_TEXT,
        slot_type: SlotType.SITUATIONAL,
        competency: competencyHint,
        industry_context: industryContext,
        count: shortDeficit,
      });
      generatedQuestions.push(
        ...generated.map((question) => ({
          ...question,
          block: 'short_text' as const,
        })),
      );
    }

    const situationalDeficit = ADVANCED_LT1_COUNT - longSituational.length;
    if (situationalDeficit > 0) {
      this.logger.warn(
        `[BANK_LOW] LT-1 (SITUATIONAL) deficit=${situationalDeficit} track=${track} level=${verifiedLevel}`,
      );
      const generated = await this.safeGenerateQuestions({
        track,
        verified_level: verifiedLevel,
        assessment_type: 'advanced',
        question_type: QuestionType.OPTIONAL_TEXT,
        slot_type: SlotType.SITUATIONAL,
        competency: competencyHint,
        industry_context: industryContext,
        count: situationalDeficit,
      });
      generatedQuestions.push(
        ...generated.map((question) => ({
          ...question,
          slot_type: SlotType.SITUATIONAL,
          block: 'long_text' as const,
        })),
      );
    }

    const workTaskDeficit = ADVANCED_LT2_COUNT - longWorkTask.length;
    if (workTaskDeficit > 0) {
      this.logger.warn(
        `[BANK_LOW] LT-2 (WORK_TASK) deficit=${workTaskDeficit} track=${track} level=${verifiedLevel}`,
      );
      const generated = await this.safeGenerateQuestions({
        track,
        verified_level: verifiedLevel,
        assessment_type: 'advanced',
        question_type: QuestionType.OPTIONAL_TEXT,
        slot_type: SlotType.WORK_TASK,
        competency: competencyHint,
        industry_context: industryContext,
        count: workTaskDeficit,
      });
      generatedQuestions.push(
        ...generated.map((question) => ({
          ...question,
          slot_type: SlotType.WORK_TASK,
          block: 'long_text' as const,
        })),
      );
    }

    const persistedGenerated = await this.persistGeneratedQuestions(
      manager,
      track,
      verifiedLevel,
      generatedQuestions,
    );

    const generatedMcq = persistedGenerated.filter((question) =>
      this.isMcq(question),
    );
    const generatedShort = persistedGenerated.filter(
      (question) =>
        !this.isMcq(question) && this.textBlock(question) === 'short_text',
    );
    const generatedSituational = persistedGenerated.filter(
      (question) =>
        !this.isMcq(question) &&
        this.textBlock(question) === 'long_text' &&
        question.slot_type === SlotType.SITUATIONAL,
    );
    const generatedWorkTask = persistedGenerated.filter(
      (question) =>
        !this.isMcq(question) &&
        this.textBlock(question) === 'long_text' &&
        question.slot_type === SlotType.WORK_TASK,
    );

    // Long text is ordered LT-1, LT-1, LT-2, LT-2.
    const longText: AssessmentQuestion[] = [
      ...longSituational,
      ...generatedSituational,
    ]
      .slice(0, ADVANCED_LT1_COUNT)
      .concat(
        [...longWorkTask, ...generatedWorkTask].slice(0, ADVANCED_LT2_COUNT),
      );

    return {
      mcq: [...mcq, ...generatedMcq].slice(0, ADVANCED_ASSESSMENT_MCQ_COUNT),
      shortText: [...shortText, ...generatedShort].slice(
        0,
        ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT,
      ),
      longText,
    };
  }

  private async safeGenerateQuestions(
    input: GenerateQuestionsInput,
  ): Promise<GeneratedQuestion[]> {
    try {
      return await this.questionGeneration.generateQuestions(input);
    } catch (error) {
      this.logger.error(
        `[BANK_LOW] AI generation failed for count=${input.count} question_type=${input.question_type} slot_type=${input.slot_type}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  private async persistGeneratedQuestions(
    manager: EntityManager,
    track: string,
    verifiedLevel: VerifiedLevel,
    generated: Array<
      GeneratedQuestion & { block: 'mcq' | 'short_text' | 'long_text' }
    >,
  ): Promise<AssessmentQuestion[]> {
    if (generated.length === 0) {
      return [];
    }

    const nextQuestionNumber = await this.nextAdvancedQuestionNumber(manager);
    const trackHasTaxonomy = competenciesForTrack(track).length > 0;

    const questions = generated.map((question, index) => {
      // Validate AI-generated competency against the track taxonomy. If
      // the model returned junk (or the track is unknown), fall back to
      // the first valid competency for the track.
      const normalisedCompetency = trackHasTaxonomy
        ? normaliseCompetency(track, question.competency)
        : (question.competency ?? null);
      const slotType =
        question.slot_type ??
        (question.block === 'long_text'
          ? SlotType.WORK_TASK
          : SlotType.SITUATIONAL);

      return manager.create(AssessmentQuestion, {
        assessment_type: AssessmentType.ADVANCED,
        question_type: question.question_type,
        question_text: question.question_text,
        question_number: nextQuestionNumber + index,
        options: question.options,
        correct_answer: question.correct_answer,
        track,
        verified_level: verifiedLevel,
        competency: normalisedCompetency,
        slot_type: slotType,
        metadata: this.buildGeneratedQuestionMetadata({
          track,
          verifiedLevel,
          questionType: question.question_type,
          competency: normalisedCompetency,
          slotType,
          block: question.block,
          industryContext: question.industry_context,
        }),
        is_live: false,
      });
    });

    return manager.save(AssessmentQuestion, questions);
  }

  private buildGeneratedQuestionMetadata(input: {
    track: string;
    verifiedLevel: VerifiedLevel;
    questionType: QuestionType;
    competency: string | null;
    slotType: SlotType;
    block: 'mcq' | 'short_text' | 'long_text';
    industryContext: string | null;
  }): Record<string, unknown> {
    const isTextQuestion =
      input.questionType === QuestionType.REQUIRED_TEXT ||
      input.questionType === QuestionType.OPTIONAL_TEXT;

    return {
      difficulty: metadataDifficulty(input.verifiedLevel),
      estimated_time_seconds: isTextQuestion ? 600 : 90,
      tags: [
        'generated',
        'advanced',
        input.track,
        input.verifiedLevel,
        input.competency,
        input.slotType,
        input.block,
      ].filter((tag): tag is string => Boolean(tag)),
      generated: true,
      answer_block: input.block,
      lt3_reflection: input.slotType === SlotType.REFLECTION,
      industry_context: input.industryContext,
      track: input.track,
      verified_level: input.verifiedLevel,
      competency: input.competency,
    };
  }

  private async nextAdvancedQuestionNumber(
    manager: EntityManager,
  ): Promise<number> {
    const row = await manager
      .createQueryBuilder(AssessmentQuestion, 'question')
      .select('MAX(question.question_number)', 'max')
      .where('question.assessment_type = :assessmentType', {
        assessmentType: AssessmentType.ADVANCED,
      })
      .getRawOne<{ max: string | null }>();

    return Number(row?.max ?? 0) + 1;
  }

  private isMcq(question: AssessmentQuestion): boolean {
    return (
      question.question_type === QuestionType.SINGLE_PICK ||
      question.question_type === QuestionType.MULTI_PICK
    );
  }

  private textBlock(question: AssessmentQuestion): 'short_text' | 'long_text' {
    const metadata = question.metadata ?? {};
    const marker = String(
      metadata.answer_block ??
        metadata.response_block ??
        metadata.answer_length ??
        metadata.expected_response_length ??
        metadata.expectedAnswerLength ??
        '',
    ).toLowerCase();

    if (marker.includes('long')) return 'long_text';
    if (marker.includes('short')) return 'short_text';

    return question.question_type === QuestionType.OPTIONAL_TEXT
      ? 'long_text'
      : 'short_text';
  }

  private toSessionResult(
    attempt: AssessmentAttempt,
    message: string,
  ): AdvancedAssessmentSessionResult {
    const questions = this.readSessionQuestions(attempt);
    const expiresAt = attempt.expires_at;

    if (!expiresAt || questions.length === 0) {
      throw new ServiceUnavailableException(
        ErrorMessages.ADVANCED_ASSESSMENT.SESSION_CORRUPT,
      );
    }

    return {
      status: 'success',
      message,
      session_id: attempt.id,
      started_at: attempt.started_at.toISOString(),
      expires_at: expiresAt.toISOString(),
      completed_at: attempt.completed_at?.toISOString() ?? null,
      is_expired: expiresAt.getTime() <= Date.now(),
      remaining_seconds: Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      ),
      verified_level: this.readSessionVerifiedLevel(attempt),
      question_count: questions.length,
      questions,
    };
  }

  private readSessionPayload(
    attempt: AssessmentAttempt,
  ): AdvancedAssessmentSessionPayload {
    const payload = attempt.generated_questions_json;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }
    return payload as AdvancedAssessmentSessionPayload;
  }

  private readSessionVerifiedLevel(attempt: AssessmentAttempt): string {
    const verifiedLevel =
      this.readSessionPayload(attempt).context?.verified_level;
    return typeof verifiedLevel === 'string' ? verifiedLevel : '';
  }

  private readSessionQuestions(
    attempt: AssessmentAttempt,
  ): AdvancedAssessmentGeneratedQuestion[] {
    const questions = this.readSessionPayload(attempt).questions;
    return Array.isArray(questions)
      ? (questions as AdvancedAssessmentGeneratedQuestion[])
      : [];
  }
}
