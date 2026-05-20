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
import { GeneratedQuestion, GuidanceReport, ScoredTextAnswer, TextAnswerInput } from '../../ai/ai.types';
import { QuestionGenerationService } from '../../ai/question-generation.service';
import { MailService } from '../../mail/mail.service';
import { UsersService } from '../../users/users.service';
import {
  FlagIntegrityEventDto,
  IntegrityEventType,
  SubmitAdvancedAssessmentDto,
} from './dto/advanced-assessment.dto';
import {
  metadataDifficulty,
  resolveCompetencyHint,
  resolveIndustryContext,
} from './assessment-utils';

const ADVANCED_ASSESSMENT_DURATION_MINUTES = 90;
const RETAKE_GATE_DAYS = 14;
const SKILL_PASS_PERCENTAGE = 75;
const ABNORMAL_LONG_TEXT_SECONDS = 5;
const TAB_SWITCH_VOID_THRESHOLD = 3;
const ADVANCED_SHORT_TEXT_MIN_CHARS = 60;
const ADVANCED_SHORT_TEXT_MAX_CHARS = 600;
const ADVANCED_LONG_TEXT_MIN_CHARS = 150;
const ADVANCED_LONG_TEXT_MAX_CHARS = 2000;

const BASE_LONG_TEXT_COUNT = ADVANCED_ASSESSMENT_LONG_TEXT_COUNT - 1;

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
    private readonly employerPoolProfileService: EmployerPoolProfileService,
    private readonly questionGeneration: QuestionGenerationService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
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

        const latestSkillResult = await this.findLatestSkillResult(
          manager,
          profile.id,
        );
        if (
          !latestSkillResult ||
          (latestSkillResult.percentage ?? 0) < SKILL_PASS_PERCENTAGE
        ) {
          throw new UnprocessableEntityException(
            ErrorMessages.ADVANCED_ASSESSMENT.SKILL_GATE_REQUIRED,
          );
        }

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

        if (aiResult.questions.length !== ADVANCED_ASSESSMENT_TOTAL_QUESTIONS) {
          this.logger.warn({
            event: 'BANK_EXHAUSTED',
            talentProfileId: profile.id,
            track: profile.track,
            verifiedLevel: profile.validated_level,
            bankFound: eligibleQuestions.length,
            totalNeeded: ADVANCED_ASSESSMENT_TOTAL_QUESTIONS,
            message: `Insufficient questions: found ${eligibleQuestions.length} bank + ${aiResult.questions.length} AI generated, need ${ADVANCED_ASSESSMENT_TOTAL_QUESTIONS}`,
          });
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

    const answerMap = new Map(dto.answers.map((answer) => [answer.question_id, answer]));
    const longTextQuestions = sessionQuestions.filter(
      (question) => question.block === 'long_text',
    );
    const lt3QuestionId =
      longTextQuestions[longTextQuestions.length - 1]?.question_id ?? null;

    let mcqRawScore = 0;
    const textInputs: TextAnswerInput[] = [];
    const responsesToSave: Partial<AssessmentResponse>[] = [];
    let hasAbnormalTiming = false;

    for (const question of sessionQuestions) {
      const submitted = answerMap.get(question.question_id);
      const isMcq =
        question.question_type === QuestionType.SINGLE_PICK ||
        question.question_type === QuestionType.MULTI_PICK;

      if (isMcq) {
        const correct = this.scoreMcq(question, submitted?.answer ?? null);
        mcqRawScore += correct ? 1 : 0;
        responsesToSave.push({
          attempt_id: attempt.id,
          question_id: question.question_id,
          question_text: question.question_text,
          user_answer: submitted?.answer ?? null,
          is_correct: correct,
          ai_evaluation_json: null,
          answered_at: new Date(),
        });
        continue;
      }

      const answer = submitted ? String(submitted.answer) : '';
      this.assertTextLength(question, answer);

      if (
        question.block === 'long_text' &&
        submitted?.time_spent_seconds !== undefined &&
        submitted.time_spent_seconds < ABNORMAL_LONG_TEXT_SECONDS &&
        answer.length > 0
      ) {
        hasAbnormalTiming = true;
      }

      textInputs.push({
        question_id: question.question_id,
        question_text: question.question_text,
        answer,
        is_lt3: question.question_id === lt3QuestionId,
      });
      responsesToSave.push({
        attempt_id: attempt.id,
        question_id: question.question_id,
        question_text: question.question_text,
        user_answer: submitted?.answer ?? null,
        is_correct: null,
        ai_evaluation_json: null,
        answered_at: new Date(),
      });
    }

    const scoredTextAnswers = await this.rubricScoring.scoreAnswers(textInputs);

    let textRawScore = 0;
    let textMaxScore = 0;
    for (const scored of scoredTextAnswers) {
      textRawScore += scored.raw_score;
      textMaxScore += scored.max_score;

      const response = responsesToSave.find(
        (entry) => entry.question_id === scored.question_id,
      );
      if (response) {
        response.ai_evaluation_json = { ...scored.rubric };
      }
    }

    const totalRawScore = mcqRawScore + textRawScore;
    const maxScore = Math.round(ADVANCED_ASSESSMENT_MCQ_COUNT + textMaxScore);
    const percentage =
      maxScore > 0 ? Math.round((totalRawScore / maxScore) * 100) : 0;

    const tier = this.resolveTier(percentage);
    const integrityConfidence = this.resolveIntegrityConfidence(
      attempt.tab_switch_count,
      hasAbnormalTiming,
    );

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
      } catch (error) {
        this.logger.warn(`Guidance report generation failed: ${String(error)}`);
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
        max_score: maxScore,
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
      } catch (error) {
        this.logger.error(
          `Employer pool profile generation failed for user=${userId}: ${String(error)}`,
        );
      }
    }

    this.logger.log(
      `Advanced assessment submitted: attempt=${attempt.id} user=${userId} score=${totalRawScore}/${maxScore} (${percentage}%) tier=${tier} expired=${isExpired}`,
    );

    await this.notifyAssessmentPerformanceEmail(userId, {
      score: Math.round(totalRawScore),
      maxScore: maxScore,
      percentage,
      tier,
    });

    return {
      status: 'success',
      message: SuccessMessages.ADVANCED_ASSESSMENT.SUBMITTED,
      session_id: attempt.id,
      score: Math.round(totalRawScore),
      max_score: maxScore,
      percentage,
      tier,
      integrity_confidence: integrityConfidence,
      ...(guidanceReport && { guidance_report: guidanceReport }),
      ...(isExpired && { auto_submitted: true }),
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
      await this.attemptRepo.increment(
        {
          id: attempt.id,
          talent_profile_id: profile.id,
          assessment_type: AssessmentType.ADVANCED,
        },
        'tab_switch_count',
        1,
      );

      const updatedAttempt = await this.attemptRepo.findOne({
        where: { id: attempt.id },
      });
      const newTabCount = updatedAttempt?.tab_switch_count ?? 0;

      if (newTabCount >= TAB_SWITCH_VOID_THRESHOLD) {
        const unlocksAt = new Date();
        unlocksAt.setDate(unlocksAt.getDate() + RETAKE_GATE_DAYS);

        await this.attemptRepo.update(
          { id: attempt.id },
          { force_submitted: true, completed_at: new Date() },
        );
        await this.talentProfileRepo.update(
          { id: profile.id },
          { assessment_locked_until: unlocksAt },
        );

        this.logger.warn(
          `Session voided - 3rd tab switch: attempt=${attempt.id} user=${userId}`,
        );

        return {
          status: 'voided',
          message: ErrorMessages.ADVANCED_ASSESSMENT.SESSION_VOIDED,
          tab_switch_count: newTabCount,
          session_voided: true,
          action: 'logout',
        };
      }

      this.logger.log(
        `Tab switch #${newTabCount}: attempt=${attempt.id} user=${userId}`,
      );

      return {
        status: 'warning',
        message: SuccessMessages.ADVANCED_ASSESSMENT.INTEGRITY_WARNED,
        tab_switch_count: newTabCount,
        session_voided: false,
        action: 'warn',
      };
    }

    await this.attemptRepo.increment(
      {
        id: attempt.id,
        talent_profile_id: profile.id,
        assessment_type: AssessmentType.ADVANCED,
      },
      'copy_paste_count',
      1,
    );

    this.logger.warn(
      `Copy-paste #${attempt.copy_paste_count + 1}: attempt=${attempt.id} user=${userId}`,
    );

    return {
      status: 'flagged',
      message: SuccessMessages.ADVANCED_ASSESSMENT.INTEGRITY_FLAGGED,
      session_voided: false,
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
    const correctAnswer = String(question.correct_answer)
      .toLowerCase()
      .trim();

    return userAnswer === correctAnswer;
  }

  private async notifyAssessmentPerformanceEmail(
    userId: string,
    result: {
      score: number;
      maxScore: number;
      percentage: number;
      tier: AssessmentTier;
    },
  ): Promise<void> {
    try {
      const user = await this.usersService.findOne(userId);
      if (!user) {
        this.logger.warn(
          `Assessment performance email skipped: user not found user=${userId}`,
        );
        return;
      }

      await this.mailService.sendAssessmentPerformance({
        to: user.email,
        recipientFirstName: user.first_name,
        score: result.score,
        maxScore: result.maxScore,
        percentage: result.percentage,
        tierLabel: this.formatTierLabel(result.tier),
      });
    } catch (error) {
      this.logger.error(
        `Assessment performance email failed for user=${userId}: ${String(error)}`,
      );
    }
  }

  private formatTierLabel(tier: AssessmentTier): string {
    switch (tier) {
      case AssessmentTier.JOB_READY:
        return 'Job Ready';
      case AssessmentTier.EMERGING:
        return 'Emerging';
      default:
        return 'Not Ready';
    }
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
      .filter((score) => score.max_score > 0 && score.raw_score / score.max_score >= 0.7)
      .map((score) => score.question_id);
  }

  private extractWeakCompetencies(scored: ScoredTextAnswer[]): string[] {
    return scored
      .filter((score) => score.max_score > 0 && score.raw_score / score.max_score < 0.5)
      .map((score) => score.question_id);
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
    const bankLong = bankText.filter(
      (question) => this.textBlock(question) === 'long_text',
    );

    const mcq = [...bankMcq.slice(0, ADVANCED_ASSESSMENT_MCQ_COUNT)];
    const shortText = [...bankShort.slice(0, ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT)];
    const longText = [...bankLong.slice(0, BASE_LONG_TEXT_COUNT)];

    const generatedQuestions: Array<GeneratedQuestion & { block: 'mcq' | 'short_text' | 'long_text' }> = [];
    const industryContext = resolveIndustryContext(personalContext);
    const competencyHint = resolveCompetencyHint(personalContext);
    const verifiedLevel = profile.validated_level ?? VerifiedLevel.ENTRY;
    const track = profile.track ?? 'general';

    const mcqDeficit = ADVANCED_ASSESSMENT_MCQ_COUNT - mcq.length;
    if (mcqDeficit > 0) {
      const generated = await this.questionGeneration.generateQuestions({
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
        ...generated.map((question) => ({ ...question, block: 'mcq' as const })),
      );
    }

    const shortDeficit = ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT - shortText.length;
    if (shortDeficit > 0) {
      const generated = await this.questionGeneration.generateQuestions({
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

    const longDeficit = BASE_LONG_TEXT_COUNT - longText.length;
    if (longDeficit > 0) {
      const generated = await this.questionGeneration.generateQuestions({
        track,
        verified_level: verifiedLevel,
        assessment_type: 'advanced',
        question_type: QuestionType.OPTIONAL_TEXT,
        slot_type: SlotType.WORK_TASK,
        competency: competencyHint,
        industry_context: industryContext,
        count: longDeficit,
      });
      generatedQuestions.push(
        ...generated.map((question) => ({ ...question, block: 'long_text' as const })),
      );
    }

    const reflectionQuestion = await this.questionGeneration.generateQuestions({
      track,
      verified_level: verifiedLevel,
      assessment_type: 'advanced',
      question_type: QuestionType.OPTIONAL_TEXT,
      slot_type: SlotType.REFLECTION,
      competency: competencyHint,
      industry_context: industryContext,
      count: 1,
    });
    generatedQuestions.push({
      ...reflectionQuestion[0],
      block: 'long_text',
    });

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
      (question) => !this.isMcq(question) && this.textBlock(question) === 'short_text',
    );
    const generatedLong = persistedGenerated.filter(
      (question) => !this.isMcq(question) && this.textBlock(question) === 'long_text',
    );

    return {
      mcq: [...mcq, ...generatedMcq].slice(0, ADVANCED_ASSESSMENT_MCQ_COUNT),
      shortText: [...shortText, ...generatedShort].slice(
        0,
        ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT,
      ),
      longText: [...longText, ...generatedLong].slice(
        0,
        ADVANCED_ASSESSMENT_LONG_TEXT_COUNT,
      ),
    };
  }

  private async persistGeneratedQuestions(
    manager: EntityManager,
    track: string,
    verifiedLevel: VerifiedLevel,
    generated: Array<GeneratedQuestion & { block: 'mcq' | 'short_text' | 'long_text' }>,
  ): Promise<AssessmentQuestion[]> {
    if (generated.length === 0) {
      return [];
    }

    const nextQuestionNumber = await this.nextAdvancedQuestionNumber(manager);
    const questions = generated.map((question, index) =>
      manager.create(AssessmentQuestion, {
        assessment_type: AssessmentType.ADVANCED,
        question_type: question.question_type,
        question_text: question.question_text,
        question_number: nextQuestionNumber + index,
        options: question.options,
        correct_answer: question.correct_answer,
        track: null,
        verified_level: null,
        competency: null,
        slot_type:
          question.slot_type ??
          (question.block === 'long_text' ? SlotType.WORK_TASK : SlotType.SITUATIONAL),
        metadata: this.buildGeneratedQuestionMetadata({
          track,
          verifiedLevel,
          questionType: question.question_type,
          competency: question.competency,
          slotType:
            question.slot_type ??
            (question.block === 'long_text' ? SlotType.WORK_TASK : SlotType.SITUATIONAL),
          block: question.block,
          industryContext: question.industry_context,
        }),
        is_live: false,
      }),
    );

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
