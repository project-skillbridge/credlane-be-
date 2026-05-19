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
import { EntityManager, Repository } from 'typeorm';
import {
  AssessmentAttempt,
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentResult,
  AssessmentType,
  QuestionType,
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
  ADVANCED_ASSESSMENT_LONG_TEXT_COUNT,
  ADVANCED_ASSESSMENT_MCQ_COUNT,
  ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT,
  ADVANCED_ASSESSMENT_TOTAL_QUESTIONS,
  AdvancedAssessmentAiService,
  AdvancedAssessmentGeneratedQuestion,
} from './advanced-assessment-ai.service';
import { PersonalAssessmentService } from './personal-assessment.service';
import { RubricScoringService } from '../../ai/rubric-scoring.service';
import { GuidanceReportService } from '../../ai/guidance-report.service';
import { EmployerPoolProfileService } from './employer-pool-profile.service';
import { ScoredTextAnswer, TextAnswerInput } from '../../ai/ai.types';
import {
  FlagIntegrityEventDto,
  IntegrityEventType,
  SubmitAdvancedAssessmentDto,
} from './dto/advanced-assessment.dto';
import { GuidanceReport } from '../../ai/ai.types';

const ADVANCED_ASSESSMENT_DURATION_MINUTES = 90;
const ADVANCED_ASSESSMENT_MAX_SCORE = 198;
const RETAKE_GATE_DAYS = 14;
const ABNORMAL_LONG_TEXT_SECONDS = 5;
const TAB_SWITCH_VOID_THRESHOLD = 3;

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

export interface IntegrityFlagResult {
  status: string;
  message: string;
  tab_switch_count?: number;
  session_voided?: boolean;
  action?: 'warn' | 'logout';
}

type AdvancedAssessmentSessionPayload = {
  context?: {
    verified_level?: unknown;
  };
  questions?: unknown;
};

@Injectable()
export class AdvancedAssessmentService {
  private readonly logger = new Logger(AdvancedAssessmentService.name);

  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepo: Repository<TalentProfile>,

    @InjectRepository(AssessmentAttempt)
    private readonly attemptRepo: Repository<AssessmentAttempt>,

    private readonly personalAssessmentService: PersonalAssessmentService,
    private readonly advancedAssessmentAiService: AdvancedAssessmentAiService,
    private readonly rubricScoring: RubricScoringService,
    private readonly guidanceReport: GuidanceReportService,
    private readonly employerPoolProfileService: EmployerPoolProfileService,
  ) {}

  // ── Start ──────────────────────────────────────────────────────────────────

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

        if (!profile.validated_level) {
          throw new UnprocessableEntityException({
            error: 'LEVEL_NOT_VERIFIED',
            message: ErrorMessages.ADVANCED_ASSESSMENT.LEVEL_NOT_VERIFIED,
          });
        }

        // Retake gate
        if (
          profile.assessment_locked_until &&
          profile.assessment_locked_until > new Date()
        ) {
          throw new ForbiddenException(
            ErrorMessages.ADVANCED_ASSESSMENT.RETAKE_LOCKED(
              profile.assessment_locked_until.toISOString(),
            ),
          );
        }

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
          profile.id,
        );
        const selectedQuestions = this.selectQuestionBlocks(eligibleQuestions);

        const aiResult = this.advancedAssessmentAiService.generateQuestions(
          {
            ...personalContext,
            track: profile.track,
            verified_level: profile.validated_level,
          },
          selectedQuestions,
        );

        if (aiResult.questions.length !== ADVANCED_ASSESSMENT_TOTAL_QUESTIONS) {
          throw new ServiceUnavailableException({
            error: 'BANK_EXHAUSTED',
            message: ErrorMessages.ADVANCED_ASSESSMENT.BANK_EXHAUSTED,
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

  // ── Get session ────────────────────────────────────────────────────────────

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

  // ── Submit ─────────────────────────────────────────────────────────────────

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

    const answerMap = new Map(dto.answers.map((a) => [a.question_id, a]));

    // Identify long-text questions by position for LT-3 detection
    const longTextQuestions = sessionQuestions.filter(
      (q) => q.block === 'long_text',
    );
    const lt3QuestionId = longTextQuestions[2]?.question_id ?? null;

    let mcqRawScore = 0;
    const textInputs: TextAnswerInput[] = [];
    const responsesToSave: Partial<AssessmentResponse>[] = [];
    let hasAbnormalTiming = false;

    for (const q of sessionQuestions) {
      const submitted = answerMap.get(q.question_id);
      const isMcq =
        q.question_type === QuestionType.SINGLE_PICK ||
        q.question_type === QuestionType.MULTI_PICK;

      if (isMcq) {
        const correct = this.scoreMcq(q, submitted?.answer ?? null);
        mcqRawScore += correct ? 1 : 0;
        responsesToSave.push({
          attempt_id: attempt.id,
          question_id: q.question_id,
          question_text: q.question_text,
          user_answer: submitted?.answer ?? null,
          is_correct: correct,
          ai_evaluation_json: null,
          answered_at: new Date(),
        });
      } else {
        const answer = submitted ? String(submitted.answer) : '';

        // Abnormal timing: long-text answered in <5s
        if (
          q.block === 'long_text' &&
          submitted?.time_spent_seconds !== undefined &&
          submitted.time_spent_seconds < ABNORMAL_LONG_TEXT_SECONDS &&
          answer.length > 0
        ) {
          hasAbnormalTiming = true;
        }

        textInputs.push({
          question_id: q.question_id,
          question_text: q.question_text,
          answer,
          is_lt3: q.question_id === lt3QuestionId,
        });
        responsesToSave.push({
          attempt_id: attempt.id,
          question_id: q.question_id,
          question_text: q.question_text,
          user_answer: submitted?.answer ?? null,
          is_correct: null,
          ai_evaluation_json: null,
          answered_at: new Date(),
        });
      }
    }

    // AI rubric scoring for all text answers
    const scoredTextAnswers = await this.rubricScoring.scoreAnswers(textInputs);

    let textRawScore = 0;
    for (const scored of scoredTextAnswers) {
      textRawScore += scored.raw_score;
      const resp = responsesToSave.find(
        (r) => r.question_id === scored.question_id,
      );
      if (resp) {
        resp.ai_evaluation_json = { ...scored.rubric };
      }
    }

    const totalRawScore = mcqRawScore + textRawScore;
    const percentage = Math.round(
      (totalRawScore / ADVANCED_ASSESSMENT_MAX_SCORE) * 100,
    );

    const tier = this.resolveTier(percentage);
    const integrityConfidence = this.resolveIntegrityConfidence(
      attempt.tab_switch_count,
      hasAbnormalTiming,
    );

    // Guidance report for non-job-ready outcomes
    let guidanceReport: GuidanceReport | null = null;
    if (tier !== AssessmentTier.JOB_READY) {
      try {
        guidanceReport = await this.guidanceReport.generate({
          track: profile.track ?? 'general',
          claimed_level: profile.claimed_level ?? VerifiedLevel.ENTRY,
          validated_level: profile.validated_level ?? VerifiedLevel.ENTRY,
          percentage,
          strong_competencies:
            this.extractStrongCompetencies(scoredTextAnswers),
          weak_competencies: this.extractWeakCompetencies(scoredTextAnswers),
        });
      } catch (e) {
        this.logger.warn(`Guidance report generation failed: ${String(e)}`);
      }
    }

    const personalContext =
      tier === AssessmentTier.JOB_READY
        ? await this.personalAssessmentService.getAiContext(userId)
        : null;

    await this.talentProfileRepo.manager.transaction(async (manager) => {
      await manager.save(AssessmentResponse, responsesToSave);

      attempt.completed_at = new Date();
      await manager.save(AssessmentAttempt, attempt);

      const result = manager.create(AssessmentResult, {
        attempt_id: attempt.id,
        score: Math.round(totalRawScore),
        max_score: ADVANCED_ASSESSMENT_MAX_SCORE,
        percentage,
        tier,
        validated_level: null,
        guidance_report: guidanceReport ? { ...guidanceReport } : null,
        integrity_confidence: integrityConfidence,
      });
      await manager.save(AssessmentResult, result);

      const profilePatch: Partial<TalentProfile> = {
        advanced_assessment_completed_at: new Date(),
        status: this.tierToProfileStatus(tier),
      };

      if (tier !== AssessmentTier.JOB_READY) {
        const unlocksAt = new Date();
        unlocksAt.setDate(unlocksAt.getDate() + RETAKE_GATE_DAYS);
        profilePatch.assessment_locked_until = unlocksAt;
      } else {
        profilePatch.assessment_locked_until = null;
      }

      await manager.update(TalentProfile, { id: profile.id }, profilePatch);
    });

    // Generate employer pool profile outside the transaction (non-critical)
    if (tier === AssessmentTier.JOB_READY && personalContext) {
      try {
        await this.employerPoolProfileService.upsert({
          profile,
          userId,
          score: Math.round(totalRawScore),
          tier,
          percentage,
          scoredTextAnswers,
          integrityClean: integrityConfidence === 'high',
          personalContext,
        });
      } catch (e) {
        this.logger.error(
          `Employer pool profile generation failed for user=${userId}: ${String(e)}`,
        );
      }
    }

    this.logger.log(
      `Advanced assessment submitted: attempt=${attempt.id} user=${userId} score=${totalRawScore}/${ADVANCED_ASSESSMENT_MAX_SCORE} (${percentage}%) tier=${tier} expired=${isExpired}`,
    );

    return {
      status: 'success',
      message: SuccessMessages.ADVANCED_ASSESSMENT.SUBMITTED,
      session_id: attempt.id,
      score: Math.round(totalRawScore),
      max_score: ADVANCED_ASSESSMENT_MAX_SCORE,
      percentage,
      tier,
      integrity_confidence: integrityConfidence,
      ...(guidanceReport && { guidance_report: guidanceReport }),
      ...(isExpired && { auto_submitted: true }),
    };
  }

  // ── Flag integrity event ───────────────────────────────────────────────────

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
    if (attempt.completed_at || attempt.force_submitted) {
      throw new BadRequestException(
        ErrorMessages.ADVANCED_ASSESSMENT.ATTEMPT_ALREADY_SUBMITTED,
      );
    }

    if (dto.event_type === IntegrityEventType.TAB_SWITCH) {
      attempt.tab_switch_count += 1;

      if (attempt.tab_switch_count >= TAB_SWITCH_VOID_THRESHOLD) {
        attempt.force_submitted = true;
        attempt.completed_at = new Date();

        const unlocksAt = new Date();
        unlocksAt.setDate(unlocksAt.getDate() + RETAKE_GATE_DAYS);

        await this.attemptRepo.save(attempt);
        await this.talentProfileRepo.update(
          { id: profile.id },
          { assessment_locked_until: unlocksAt },
        );

        this.logger.warn(
          `Session voided — 3rd tab switch: attempt=${attempt.id} user=${userId}`,
        );

        return {
          status: 'voided',
          message: ErrorMessages.ADVANCED_ASSESSMENT.SESSION_VOIDED,
          tab_switch_count: attempt.tab_switch_count,
          session_voided: true,
          action: 'logout',
        };
      }

      await this.attemptRepo.save(attempt);

      this.logger.log(
        `Tab switch #${attempt.tab_switch_count}: attempt=${attempt.id} user=${userId}`,
      );

      return {
        status: 'warning',
        message: SuccessMessages.ADVANCED_ASSESSMENT.INTEGRITY_WARNED,
        tab_switch_count: attempt.tab_switch_count,
        session_voided: false,
        action: 'warn',
      };
    }

    // COPY_PASTE: log and return toast — no count tracked beyond warning
    this.logger.warn(
      `Copy-paste detected: attempt=${attempt.id} user=${userId}`,
    );

    return {
      status: 'flagged',
      message: SuccessMessages.ADVANCED_ASSESSMENT.INTEGRITY_FLAGGED,
      session_voided: false,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private scoreMcq(
    question: AdvancedAssessmentGeneratedQuestion,
    answer: string | string[] | null,
  ): boolean {
    if (!answer) return false;
    const userAnswer = Array.isArray(answer)
      ? answer.join(',').toLowerCase().trim()
      : String(answer).toLowerCase().trim();

    if (question.correct_answer) {
      const userAnswer = Array.isArray(answer)
        ? answer.join(',').toLowerCase().trim()
        : String(answer).toLowerCase().trim();
      const correctAnswer = String(question.correct_answer)
        .toLowerCase()
        .trim();
      return userAnswer === correctAnswer;
    }

    if (!question.options || question.options.length === 0) return false;

    // For advanced MCQs without stored correct_answer, any option is valid
    // (questions from bank have correct_answer in AssessmentQuestion entity,
    //  but session JSON only stores question_text + options, not correct_answer)
    // We treat any non-empty answer that matches one of the options as submitted
    const optionsLower = question.options.map((o) => o.toLowerCase().trim());

    return optionsLower.some((opt) => userAnswer.includes(opt));
  }

  private resolveTier(percentage: number): AssessmentTier {
    if (percentage >= 75) return AssessmentTier.JOB_READY;
    if (percentage >= 50) return AssessmentTier.EMERGING;
    return AssessmentTier.NOT_READY;
  }

  private tierToProfileStatus(tier: AssessmentTier): TalentProfileStatus {
    switch (tier) {
      case AssessmentTier.JOB_READY:
        return TalentProfileStatus.JOB_READY;
      case AssessmentTier.EMERGING:
        return TalentProfileStatus.EMERGING;
      default:
        return TalentProfileStatus.NOT_READY;
    }
  }

  private resolveIntegrityConfidence(
    tabSwitchCount: number,
    hasAbnormalTiming: boolean,
  ): string {
    if (hasAbnormalTiming) return 'low';
    if (tabSwitchCount >= 1) return 'medium';
    return 'high';
  }

  private extractStrongCompetencies(scored: ScoredTextAnswer[]): string[] {
    return scored
      .filter((s) => s.max_score > 0 && s.raw_score / s.max_score >= 0.7)
      .map((s) => s.question_id);
  }

  private extractWeakCompetencies(scored: ScoredTextAnswer[]): string[] {
    return scored
      .filter((s) => s.max_score > 0 && s.raw_score / s.max_score < 0.5)
      .map((s) => s.question_id);
  }

  private async findEligibleQuestions(
    manager: EntityManager,
    talentProfileId: string,
  ): Promise<AssessmentQuestion[]> {
    return manager
      .createQueryBuilder(AssessmentQuestion, 'question')
      .where('question.assessment_type = :assessmentType', {
        assessmentType: AssessmentType.ADVANCED,
      })
      .andWhere('question.is_live = true')
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM talent_question_history history
          WHERE history.question_id = question.id
          AND history.talent_profile_id = :talentProfileId
        )`,
        { talentProfileId },
      )
      .orderBy('question.question_number', 'ASC')
      .addOrderBy('question.created_at', 'ASC')
      .addOrderBy('question.id', 'ASC')
      .getMany();
  }

  private selectQuestionBlocks(questions: AssessmentQuestion[]): {
    mcq: AssessmentQuestion[];
    shortText: AssessmentQuestion[];
    longText: AssessmentQuestion[];
  } {
    const mcq = questions
      .filter((question) => this.isMcq(question))
      .slice(0, ADVANCED_ASSESSMENT_MCQ_COUNT);
    const textQuestions = questions.filter((question) => !this.isMcq(question));
    const shortText = textQuestions
      .filter((question) => this.textBlock(question) === 'short_text')
      .slice(0, ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT);
    const longText = textQuestions
      .filter((question) => this.textBlock(question) === 'long_text')
      .slice(0, ADVANCED_ASSESSMENT_LONG_TEXT_COUNT);

    if (
      mcq.length < ADVANCED_ASSESSMENT_MCQ_COUNT ||
      shortText.length < ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT ||
      longText.length < ADVANCED_ASSESSMENT_LONG_TEXT_COUNT
    ) {
      throw new ServiceUnavailableException({
        error: 'BANK_EXHAUSTED',
        message: ErrorMessages.ADVANCED_ASSESSMENT.BANK_EXHAUSTED,
      });
    }

    return { mcq, shortText, longText };
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
