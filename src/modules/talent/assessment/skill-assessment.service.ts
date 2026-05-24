import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  In,
  IsNull,
  LessThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
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
import {
  TalentProfile,
  TalentProfileStatus,
} from '../entities/talent-profile.entity';
import {
  FlagIntegrityEventDto,
  IntegrityEventType,
  IntegrityFlagResult,
} from './dto/integrity-event.dto';
import { SubmitSkillAssessmentDto } from './dto/skill-assessment.dto';
import { ErrorMessages, SuccessMessages } from '../../../shared';
import {
  SKILL_ASSESSMENT_MAX_ATTEMPTS,
  SKILL_ASSESSMENT_PASS_PERCENTAGE,
} from '../talent.constants';
import {
  AssessmentAnswerBlock,
  textLengthBoundsForBlock,
} from './assessment-answer-blocks.constants';
import { RubricScoringService } from '../../ai/rubric-scoring.service';
import { GuidanceReportService } from '../../ai/guidance-report.service';
import { QuestionGenerationService } from '../../ai/question-generation.service';
import { GuidanceReport, ScoredTextAnswer } from '../../ai/ai.types';

const SKILL_ASSESSMENT_MCQ_COUNT = 6;
const SKILL_ASSESSMENT_TEXT_COUNT = 4;
const SKILL_PROBE_MCQ_COUNT = 2;
const SKILL_PROBE_TEXT_COUNT = 2;
const SKILL_MCQ_SECTION_WEIGHT = 0.4;

type ProbeDirection = 'above' | 'below';

export interface SkillAssessmentQuestion {
  question_id: string;
  question_number: number;
  block: AssessmentAnswerBlock;
  question_type: QuestionType;
  question_text: string;
  options: string[] | null;
}

type SkillAssessmentSessionQuestion = SkillAssessmentQuestion & {
  correct_answer: string | null;
  is_probe?: boolean;
  probe_direction?: ProbeDirection;
};

type SkillAssessmentSessionPayload = {
  context?: {
    verified_level?: VerifiedLevel;
    attempt_number?: number;
  };
  questions?: SkillAssessmentSessionQuestion[];
};

export interface StartSkillAssessmentResult {
  status: string;
  message: string;
  session_id: string;
  attempt_number: number;
  verified_level: VerifiedLevel;
  questions: SkillAssessmentQuestion[];
}

export interface SkillAssessmentSessionResult {
  status: string;
  message: string;
  attempt_id: string;
  session_id: string;
  attempt_number: number;
  started_at: string;
  verified_level: VerifiedLevel;
  questions: SkillAssessmentQuestion[];
}

export interface SubmitSkillAssessmentResult {
  status: string;
  message: string;
  session_id: string;
  attempt_number: number;
  score: number;
  total: number;
  percentage: number;
  validated_level: VerifiedLevel;
  claimed_level: VerifiedLevel;
  downgraded: boolean;
  passed: boolean;
  guidance_report?: GuidanceReport;
  personalised_message?: string;
}

const LEVEL_ORDER: Record<VerifiedLevel, number> = {
  [VerifiedLevel.JUNIOR]: 0,
  [VerifiedLevel.MID]: 1,
  [VerifiedLevel.SENIOR]: 2,
  [VerifiedLevel.EXPERT]: 3,
};

function levelIsLower(a: VerifiedLevel, b: VerifiedLevel): boolean {
  return LEVEL_ORDER[a] < LEVEL_ORDER[b];
}

@Injectable()
export class SkillAssessmentService {
  private readonly logger = new Logger(SkillAssessmentService.name);

  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepo: Repository<TalentProfile>,

    @InjectRepository(AssessmentQuestion)
    private readonly questionRepo: Repository<AssessmentQuestion>,

    @InjectRepository(AssessmentAttempt)
    private readonly attemptRepo: Repository<AssessmentAttempt>,

    @InjectRepository(AssessmentResponse)
    private readonly responseRepo: Repository<AssessmentResponse>,

    @InjectRepository(AssessmentResult)
    private readonly resultRepo: Repository<AssessmentResult>,

    @InjectRepository(TalentQuestionHistory)
    private readonly historyRepo: Repository<TalentQuestionHistory>,

    private readonly rubricScoring: RubricScoringService,
    private readonly guidanceReport: GuidanceReportService,
    private readonly questionGeneration: QuestionGenerationService,
  ) {}

  private async resolveSkillAttemptNumber(
    talentProfileId: string,
    attempt: AssessmentAttempt,
    payload: SkillAssessmentSessionPayload,
    manager?: EntityManager,
  ): Promise<number> {
    const fromPayload = payload.context?.attempt_number;
    if (
      typeof fromPayload === 'number' &&
      Number.isInteger(fromPayload) &&
      fromPayload >= 1
    ) {
      return fromPayload;
    }

    const attemptRepository = manager
      ? manager.getRepository(AssessmentAttempt)
      : this.attemptRepo;

    const ordinal = await attemptRepository.count({
      where: {
        talent_profile_id: talentProfileId,
        assessment_type: AssessmentType.SKILL,
        started_at: LessThanOrEqual(attempt.started_at),
      },
    });

    return Math.max(1, ordinal);
  }

  private countCompletedSkillAttempts(
    talentProfileId: string,
    manager?: EntityManager,
  ): Promise<number> {
    const attemptRepository = manager
      ? manager.getRepository(AssessmentAttempt)
      : this.attemptRepo;

    return attemptRepository.count({
      where: {
        talent_profile_id: talentProfileId,
        assessment_type: AssessmentType.SKILL,
        completed_at: Not(IsNull()),
      },
    });
  }

  private async assertSkillAssessmentAttemptsRemaining(
    profile: TalentProfile,
    manager?: EntityManager,
  ): Promise<void> {
    if (profile.advanced_assessment_completed_at) {
      return;
    }

    const attemptRepository = manager
      ? manager.getRepository(AssessmentAttempt)
      : this.attemptRepo;

    const completedAttempts = await this.countCompletedSkillAttempts(
      profile.id,
      manager,
    );
    if (completedAttempts >= SKILL_ASSESSMENT_MAX_ATTEMPTS) {
      throw new ForbiddenException(
        ErrorMessages.SKILL_ASSESSMENT.MAX_ATTEMPTS_REACHED,
      );
    }

    if (manager) {
      const activeAttempt = await attemptRepository.findOne({
        where: {
          talent_profile_id: profile.id,
          assessment_type: AssessmentType.SKILL,
          completed_at: IsNull(),
          force_submitted: false,
        },
      });

      if (activeAttempt) {
        throw new ConflictException({
          error: 'CONFLICT',
          message: ErrorMessages.SKILL_ASSESSMENT.ACTIVE_SESSION_EXISTS,
          existing_session_id: activeAttempt.id,
        });
      }
    }
  }

  async start(userId: string): Promise<StartSkillAssessmentResult> {
    const profile = await this.talentProfileRepo.findOne({
      where: { user_id: userId },
    });

    if (!profile) {
      throw new NotFoundException(
        ErrorMessages.SKILL_ASSESSMENT.PROFILE_NOT_FOUND,
      );
    }

    if (!profile.personal_assessment_completed_at) {
      throw new UnprocessableEntityException(
        ErrorMessages.SKILL_ASSESSMENT.PERSONAL_ASSESSMENT_INCOMPLETE,
      );
    }
    if (!profile.claimed_level) {
      throw new UnprocessableEntityException(
        ErrorMessages.SKILL_ASSESSMENT.CLAIMED_LEVEL_MISSING,
      );
    }
    if (!profile.track) {
      throw new UnprocessableEntityException(
        ErrorMessages.SKILL_ASSESSMENT.TRACK_MISSING,
      );
    }
    const verifiedLevel = profile.claimed_level;
    const { savedAttempt, orderedQuestions, attemptNumber } =
      await this.talentProfileRepo.manager.transaction(async (manager) => {
        const lockedProfile = await manager.findOne(TalentProfile, {
          where: { id: profile.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!lockedProfile) {
          throw new NotFoundException(
            ErrorMessages.SKILL_ASSESSMENT.PROFILE_NOT_FOUND,
          );
        }

        await this.assertSkillAssessmentAttemptsRemaining(
          lockedProfile,
          manager,
        );

        const rawBankQuestions = await this.findEligibleSkillQuestions(
          manager,
          lockedProfile,
          verifiedLevel,
        );
        const bankQuestions = await this.ensureSkillQuestionsWithAI(
          manager,
          lockedProfile,
          verifiedLevel,
          rawBankQuestions,
        );
        const selectedQuestions = this.selectSkillQuestionMix(bankQuestions);

        let aboveProbeQuestions: AssessmentQuestion[] = [];
        const aboveLevel = this.levelAbove(verifiedLevel);
        if (aboveLevel) {
          const aboveBank = await this.findEligibleSkillQuestions(
            manager,
            lockedProfile,
            aboveLevel,
          );
          aboveProbeQuestions = this.selectSkillProbeMix(aboveBank);
        }

        let belowProbeQuestions: AssessmentQuestion[] = [];
        const belowLevel = this.levelBelowForProbe(verifiedLevel);
        if (belowLevel) {
          const belowBank = await this.findEligibleSkillQuestions(
            manager,
            lockedProfile,
            belowLevel,
          );
          belowProbeQuestions = this.selectSkillProbeMix(belowBank);
        }

        const allSelected = [
          ...selectedQuestions,
          ...aboveProbeQuestions,
          ...belowProbeQuestions,
        ];
        const primaryCount = selectedQuestions.length;
        const aboveCount = aboveProbeQuestions.length;
        const orderedQuestions = allSelected.map((question, index) => {
          let is_probe = false;
          let probe_direction: ProbeDirection | undefined;
          if (index >= primaryCount) {
            is_probe = true;
            probe_direction =
              index < primaryCount + aboveCount ? 'above' : 'below';
          }
          return {
            question_id: question.id,
            question_number: index + 1,
            block: this.blockForQuestionType(question.question_type),
            question_type: question.question_type,
            question_text: question.question_text,
            options: question.options,
            correct_answer: question.correct_answer,
            is_probe,
            probe_direction,
          };
        });
        const completedAttempts = await this.countCompletedSkillAttempts(
          lockedProfile.id,
          manager,
        );
        const attemptNumber = completedAttempts + 1;
        const startedAt = new Date();
        const attempt = await manager.save(
          AssessmentAttempt,
          manager.create(AssessmentAttempt, {
            talent_profile_id: lockedProfile.id,
            assessment_type: AssessmentType.SKILL,
            started_at: startedAt,
            completed_at: null,
            expires_at: null,
            generated_questions_json: {
              context: {
                verified_level: verifiedLevel,
                attempt_number: attemptNumber,
              },
              questions: orderedQuestions,
            },
          }),
        );

        await manager.save(
          TalentQuestionHistory,
          allSelected.map((question) =>
            manager.create(TalentQuestionHistory, {
              talent_profile_id: lockedProfile.id,
              question_id: question.id,
              attempt_id: attempt.id,
              user_answer: { served: true },
              is_correct: null,
              raw_score: null,
              max_score: null,
              answered_at: startedAt,
            }),
          ),
        );

        return { savedAttempt: attempt, orderedQuestions, attemptNumber };
      });

    this.logger.log(
      `Skill assessment started: attempt=${savedAttempt.id} attempt_number=${attemptNumber} user=${userId} track=${profile.track} level=${verifiedLevel}`,
    );

    return {
      status: 'success',
      message: SuccessMessages.SKILL_ASSESSMENT.STARTED,
      session_id: savedAttempt.id,
      attempt_number: attemptNumber,
      verified_level: verifiedLevel,
      questions: this.toPublicSessionQuestions(orderedQuestions),
    };
  }

  async getSession(
    userId: string,
    sessionId: string,
  ): Promise<SkillAssessmentSessionResult> {
    const profile = await this.talentProfileRepo.findOne({
      where: { user_id: userId },
    });
    if (!profile) {
      throw new NotFoundException(
        ErrorMessages.SKILL_ASSESSMENT.PROFILE_NOT_FOUND,
      );
    }

    const attempt = await this.attemptRepo.findOne({
      where: {
        id: sessionId,
        talent_profile_id: profile.id,
        assessment_type: AssessmentType.SKILL,
      },
    });
    if (!attempt) {
      throw new NotFoundException(
        ErrorMessages.SKILL_ASSESSMENT.ATTEMPT_NOT_FOUND,
      );
    }

    const payload = this.readSessionPayload(attempt);
    const questions = Array.isArray(payload.questions) ? payload.questions : [];
    if (questions.length === 0) {
      throw new BadRequestException(
        ErrorMessages.SKILL_ASSESSMENT.ATTEMPT_CORRUPT,
      );
    }

    const attemptNumber = await this.resolveSkillAttemptNumber(
      profile.id,
      attempt,
      payload,
    );

    return {
      status: 'success',
      message: SuccessMessages.SKILL_ASSESSMENT.SESSION_RESUMED,
      attempt_id: attempt.id,
      session_id: attempt.id,
      attempt_number: attemptNumber,
      started_at: attempt.started_at.toISOString(),
      verified_level:
        payload.context?.verified_level ??
        profile.claimed_level ??
        VerifiedLevel.JUNIOR,
      questions: this.toPublicSessionQuestions(questions),
    };
  }

  async submit(
    userId: string,
    dto: SubmitSkillAssessmentDto,
  ): Promise<SubmitSkillAssessmentResult> {
    const profile = await this.talentProfileRepo.findOne({
      where: { user_id: userId },
    });
    if (!profile) {
      throw new NotFoundException(
        ErrorMessages.SKILL_ASSESSMENT.PROFILE_NOT_FOUND,
      );
    }

    const attempt = await this.attemptRepo.findOne({
      where: {
        id: dto.attempt_id,
        talent_profile_id: profile.id,
        assessment_type: AssessmentType.SKILL,
      },
    });
    if (!attempt) {
      throw new NotFoundException(
        ErrorMessages.SKILL_ASSESSMENT.ATTEMPT_NOT_FOUND,
      );
    }
    if (attempt.completed_at) {
      throw new BadRequestException(
        ErrorMessages.SKILL_ASSESSMENT.ATTEMPT_ALREADY_SUBMITTED,
      );
    }

    const sessionQuestions = this.readSessionQuestions(attempt);
    if (sessionQuestions.length === 0) {
      throw new BadRequestException(
        ErrorMessages.SKILL_ASSESSMENT.ATTEMPT_CORRUPT,
      );
    }

    const questionEntities = await this.questionRepo.findBy({
      id: In(sessionQuestions.map((question) => question.question_id)),
    });
    const entityMap = new Map(
      questionEntities.map((question) => [question.id, question]),
    );
    const answerMap = new Map(
      dto.answers.map((answer) => [answer.question_id, answer]),
    );

    let primaryMcqCorrect = 0;
    let primaryMcqTotal = 0;
    let aboveProbeMcqCorrect = 0;
    let aboveProbeMcqTotal = 0;
    let belowProbeMcqCorrect = 0;
    let belowProbeMcqTotal = 0;
    const primaryTextAnswers: Array<{
      question: SkillAssessmentSessionQuestion;
      answer: string;
      grading_rubric: Record<string, unknown> | null;
    }> = [];
    const aboveProbeTextAnswers: Array<{
      question: SkillAssessmentSessionQuestion;
      answer: string;
      grading_rubric: Record<string, unknown> | null;
    }> = [];
    const belowProbeTextAnswers: Array<{
      question: SkillAssessmentSessionQuestion;
      answer: string;
      grading_rubric: Record<string, unknown> | null;
    }> = [];
    const responsesToSave: Partial<AssessmentResponse>[] = [];
    const historyPatches = new Map<string, Partial<TalentQuestionHistory>>();

    for (const question of sessionQuestions) {
      const submitted = answerMap.get(question.question_id);
      const isMcq =
        question.question_type === QuestionType.SINGLE_PICK ||
        question.question_type === QuestionType.MULTI_PICK;
      const entity = entityMap.get(question.question_id);
      const metadata = (entity?.metadata ?? {}) as Record<string, unknown>;
      const gradingRubric =
        metadata.grading_rubric && typeof metadata.grading_rubric === 'object'
          ? (metadata.grading_rubric as Record<string, unknown>)
          : null;

      let isCorrect: boolean | null = null;
      if (isMcq) {
        if (question.is_probe) {
          if (question.probe_direction === 'below') {
            belowProbeMcqTotal++;
          } else {
            aboveProbeMcqTotal++;
          }
        } else {
          primaryMcqTotal++;
        }
        isCorrect = this.scoreGeneratedMcq(question, submitted?.answer ?? null);
        if (isCorrect) {
          if (question.is_probe) {
            if (question.probe_direction === 'below') {
              belowProbeMcqCorrect++;
            } else {
              aboveProbeMcqCorrect++;
            }
          } else {
            primaryMcqCorrect++;
          }
        }
      } else {
        const answer = submitted ? String(submitted.answer) : '';
        this.assertTextLength(question, answer);
        const payload = { question, answer, grading_rubric: gradingRubric };
        if (question.is_probe) {
          if (question.probe_direction === 'below') {
            belowProbeTextAnswers.push(payload);
          } else {
            aboveProbeTextAnswers.push(payload);
          }
        } else {
          primaryTextAnswers.push(payload);
        }
      }

      responsesToSave.push({
        attempt_id: attempt.id,
        question_id: entity?.id ?? null,
        question_text: question.question_text,
        user_answer: submitted?.answer ?? null,
        is_correct: isCorrect,
        answered_at: new Date(),
      });

      if (entity) {
        historyPatches.set(question.question_id, {
          user_answer: submitted?.answer ?? null,
          is_correct: isCorrect,
          raw_score: isCorrect === null ? null : isCorrect ? 1 : 0,
          max_score: isCorrect === null ? null : 1,
          answered_at: new Date(),
        });
      }
    }

    const scoreTextBatch = async (
      items: Array<{
        question: SkillAssessmentSessionQuestion;
        answer: string;
        grading_rubric: Record<string, unknown> | null;
      }>,
    ) => {
      if (items.length === 0) {
        return { score: 0, maxScore: 0, scored: [] as ScoredTextAnswer[] };
      }

      const scored = await this.rubricScoring.scoreAnswers(
        items.map(({ question, answer, grading_rubric }) => ({
          question_id: question.question_id,
          question_text: question.question_text,
          answer,
          grading_rubric: grading_rubric as never,
        })),
      );

      let score = 0;
      let maxScore = 0;
      for (const entry of scored) {
        score += entry.raw_score;
        maxScore += entry.max_score;
      }

      return { score, maxScore, scored };
    };

    const primaryText = await scoreTextBatch(primaryTextAnswers);
    const aboveProbeText = await scoreTextBatch(aboveProbeTextAnswers);
    const belowProbeText = await scoreTextBatch(belowProbeTextAnswers);

    for (const scored of [
      ...primaryText.scored,
      ...aboveProbeText.scored,
      ...belowProbeText.scored,
    ]) {
      const response = responsesToSave.find(
        (entry) => entry.question_id === scored.question_id,
      );
      if (response) {
        response.ai_evaluation_json = { ...scored.rubric };
      }

      const historyEntry = historyPatches.get(scored.question_id);
      if (historyEntry) {
        historyEntry.raw_score = scored.raw_score;
        historyEntry.max_score = scored.max_score;
      }
    }

    const aboveProbeMaxScore = aboveProbeMcqTotal + aboveProbeText.maxScore;
    const primaryWeighted = this.toWeightedSectionScore(
      primaryMcqCorrect,
      primaryMcqTotal,
      primaryText.score,
      primaryText.maxScore,
      SKILL_MCQ_SECTION_WEIGHT,
    );
    const aboveWeighted = this.toWeightedSectionScore(
      aboveProbeMcqCorrect,
      aboveProbeMcqTotal,
      aboveProbeText.score,
      aboveProbeText.maxScore,
      SKILL_MCQ_SECTION_WEIGHT,
    );
    const belowWeighted = this.toWeightedSectionScore(
      belowProbeMcqCorrect,
      belowProbeMcqTotal,
      belowProbeText.score,
      belowProbeText.maxScore,
      SKILL_MCQ_SECTION_WEIGHT,
    );

    const claimedPercentage = primaryWeighted.percentage;
    const aboveLevelPercentage = aboveWeighted.percentage;
    const belowLevelPercentage = belowWeighted.percentage;

    const weightedSections = [primaryWeighted, aboveWeighted, belowWeighted]
      .filter((section) => section.maxScore > 0);
    const totalScore = weightedSections.reduce(
      (sum, section) => sum + section.score,
      0,
    );
    const totalMaxScore = weightedSections.reduce(
      (sum, section) => sum + section.maxScore,
      0,
    );
    const percentage = this.toPercentage(totalScore, totalMaxScore);
    const primaryMcqGatePassed =
      primaryMcqTotal === 0 || primaryMcqCorrect > 0;
    const aboveProbeMcqGatePassed =
      aboveProbeMcqTotal === 0 || aboveProbeMcqCorrect > 0;

    if (primaryMcqTotal === 0) {
      this.logger.warn(
        `Skill assessment primary MCQ gate bypassed: no primary MCQs attempt=${attempt.id} user=${userId}`,
      );
    }
    if (aboveProbeMaxScore > 0 && aboveProbeMcqTotal === 0) {
      this.logger.warn(
        `Skill assessment above-level MCQ gate bypassed: no above-level MCQs attempt=${attempt.id} user=${userId}`,
      );
    }

    const validatedLevel = this.resolveValidatedLevel(
      claimedPercentage,
      aboveLevelPercentage,
      belowLevelPercentage,
      percentage,
      profile.claimed_level ?? VerifiedLevel.JUNIOR,
      primaryMcqGatePassed,
      aboveProbeMcqGatePassed,
    );
    const claimed = profile.claimed_level ?? VerifiedLevel.JUNIOR;
    const downgraded = levelIsLower(validatedLevel, claimed);
    const passed =
      claimedPercentage >= SKILL_ASSESSMENT_PASS_PERCENTAGE &&
      primaryMcqGatePassed;
    const tier = this.resolveSkillTier(percentage);

    let guidanceReport: GuidanceReport | null = null;
    if (!passed) {
      try {
        guidanceReport = await this.guidanceReport.generate({
          report_type: 'emerging',
          track: profile.track ?? 'general',
          claimed_level: claimed,
          validated_level: validatedLevel,
          percentage,
          strong_competencies: this.extractStrongCompetencies(
            [
              ...primaryText.scored,
              ...aboveProbeText.scored,
              ...belowProbeText.scored,
            ],
            entityMap,
          ),
          weak_competencies: this.extractWeakCompetencies(
            [
              ...primaryText.scored,
              ...aboveProbeText.scored,
              ...belowProbeText.scored,
            ],
            entityMap,
          ),
        });
      } catch (error) {
        this.logger.warn(
          `Skill guidance report generation failed: ${String(error)}`,
        );
      }
    }

    await this.talentProfileRepo.manager.transaction(async (manager) => {
      await manager.save(AssessmentResponse, responsesToSave);
      for (const [questionId, patch] of historyPatches) {
        await manager.update(
          TalentQuestionHistory,
          {
            talent_profile_id: profile.id,
            question_id: questionId,
            attempt_id: attempt.id,
          },
          patch,
        );
      }

      attempt.completed_at = new Date();
      await manager.save(AssessmentAttempt, attempt);

      const result = manager.create(AssessmentResult, {
        attempt_id: attempt.id,
        score: Math.round(totalScore),
        max_score: totalMaxScore,
        percentage,
        claimed_percentage: claimedPercentage,
        validated_level: validatedLevel,
        tier: null,
        guidance_report: guidanceReport ? { ...guidanceReport } : null,
      });
      await manager.save(AssessmentResult, result);

      await manager.update(
        TalentProfile,
        { id: profile.id },
        {
          validated_level: validatedLevel,
          skill_assessment_completed_at: new Date(),
          status: this.skillTierToProfileStatus(tier, passed),
        },
      );
    });

    this.logger.log(
      `Skill assessment submitted: attempt=${attempt.id} user=${userId} score=${totalScore}/${totalMaxScore} pct=${percentage} validated=${validatedLevel} passed=${passed} downgraded=${downgraded}`,
    );

    const attemptNumber = await this.resolveSkillAttemptNumber(
      profile.id,
      attempt,
      this.readSessionPayload(attempt),
    );

    return {
      status: 'success',
      message: SuccessMessages.SKILL_ASSESSMENT.SUBMITTED,
      session_id: attempt.id,
      attempt_number: attemptNumber,
      score: Math.round(totalScore),
      total: totalMaxScore,
      percentage,
      validated_level: validatedLevel,
      claimed_level: claimed,
      downgraded,
      passed,
      ...(guidanceReport && { guidance_report: guidanceReport }),
      ...(downgraded && {
        personalised_message: SuccessMessages.SKILL_ASSESSMENT.DOWNGRADE_NOTICE,
      }),
    };
  }

  private async findEligibleSkillQuestions(
    manager: EntityManager,
    profile: TalentProfile,
    verifiedLevel: VerifiedLevel,
  ): Promise<AssessmentQuestion[]> {
    const lastAttempt = await manager.getRepository(AssessmentAttempt).findOne({
      where: {
        talent_profile_id: profile.id,
        assessment_type: AssessmentType.SKILL,
        completed_at: Not(IsNull()),
      },
      order: { completed_at: 'DESC' },
    });

    const qb = manager
      .createQueryBuilder(AssessmentQuestion, 'question')
      .where('question.assessment_type = :assessmentType', {
        assessmentType: AssessmentType.SKILL,
      })
      .andWhere('question.is_live = true')
      .andWhere('question.track = :track', { track: profile.track })
      .andWhere('question.verified_level = :verifiedLevel', { verifiedLevel });

    if (lastAttempt) {
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM talent_question_history history
          WHERE history.question_id = question.id
          AND history.talent_profile_id = :talentProfileId
          AND history.attempt_id = :lastAttemptId
        )`,
        { talentProfileId: profile.id, lastAttemptId: lastAttempt.id },
      );
    }

    return qb.orderBy('RANDOM()').getMany();
  }

  private async ensureSkillQuestionsWithAI(
    manager: EntityManager,
    profile: TalentProfile,
    verifiedLevel: VerifiedLevel,
    bankQuestions: AssessmentQuestion[],
  ): Promise<AssessmentQuestion[]> {
    const mcqs = bankQuestions.filter((q) => this.isPickQuestion(q));
    const texts = bankQuestions.filter((q) => !this.isPickQuestion(q));

    const neededMcqs = Math.max(0, SKILL_ASSESSMENT_MCQ_COUNT - mcqs.length);
    const neededTexts = Math.max(
      0,
      SKILL_ASSESSMENT_TEXT_COUNT - texts.length,
    );

    if (neededMcqs === 0 && neededTexts === 0) {
      return bankQuestions;
    }

    this.logger.log(
      `Generating AI questions for track=${profile.track} level=${verifiedLevel}: ${neededMcqs} MCQ, ${neededTexts} text`,
    );

    const [generatedMcqs, generatedTexts] = await Promise.all([
      neededMcqs > 0
        ? this.questionGeneration.generateQuestions({
            track: profile.track!,
            verified_level: verifiedLevel,
            assessment_type: 'skill',
            question_type: QuestionType.SINGLE_PICK,
            count: neededMcqs,
          })
        : Promise.resolve([]),
      neededTexts > 0
        ? this.questionGeneration.generateQuestions({
            track: profile.track!,
            verified_level: verifiedLevel,
            assessment_type: 'skill',
            question_type: QuestionType.REQUIRED_TEXT,
            count: neededTexts,
          })
        : Promise.resolve([]),
    ]);

    const allGenerated = [...generatedMcqs, ...generatedTexts];
    if (allGenerated.length === 0) {
      return bankQuestions;
    }

    const questionRepo = manager.getRepository(AssessmentQuestion);
    const existingCount = await questionRepo.count({
      where: {
        assessment_type: AssessmentType.SKILL,
        track: profile.track ?? undefined,
        verified_level: verifiedLevel,
      },
    });

    const persistedEntities = await manager.save(
      AssessmentQuestion,
      allGenerated.map((q, i) =>
        manager.create(AssessmentQuestion, {
          assessment_type: AssessmentType.SKILL,
          question_type: q.question_type,
          question_text: q.question_text,
          question_number: existingCount + i + 1,
          options: q.options,
          correct_answer: q.correct_answer,
          track: profile.track,
          verified_level: verifiedLevel,
          competency: q.competency,
          slot_type: q.slot_type,
          is_live: true,
        }),
      ),
    );

    this.logger.log(
      `Persisted ${persistedEntities.length} AI-generated questions for track=${profile.track} level=${verifiedLevel}`,
    );

    return [...bankQuestions, ...persistedEntities];
  }

  private selectSkillQuestionMix(
    bankQuestions: AssessmentQuestion[],
  ): AssessmentQuestion[] {
    const mcqs = bankQuestions
      .filter((question) => this.isPickQuestion(question))
      .slice(0, SKILL_ASSESSMENT_MCQ_COUNT);
    const text = bankQuestions
      .filter((question) => !this.isPickQuestion(question))
      .slice(0, SKILL_ASSESSMENT_TEXT_COUNT);

    if (
      mcqs.length < SKILL_ASSESSMENT_MCQ_COUNT ||
      text.length < SKILL_ASSESSMENT_TEXT_COUNT
    ) {
      throw new UnprocessableEntityException(
        ErrorMessages.SKILL_ASSESSMENT.NO_QUESTIONS_AVAILABLE,
      );
    }

    return [...mcqs, ...text];
  }

  private isPickQuestion(question: AssessmentQuestion): boolean {
    return (
      question.question_type === QuestionType.SINGLE_PICK ||
      question.question_type === QuestionType.MULTI_PICK
    );
  }

  private readSessionPayload(
    attempt: AssessmentAttempt,
  ): SkillAssessmentSessionPayload {
    const payload = attempt.generated_questions_json;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }
    return payload as SkillAssessmentSessionPayload;
  }

  private readSessionQuestions(
    attempt: AssessmentAttempt,
  ): SkillAssessmentSessionQuestion[] {
    const questions = this.readSessionPayload(attempt).questions;
    return Array.isArray(questions) ? questions : [];
  }

  private toPublicSessionQuestions(
    questions: SkillAssessmentSessionQuestion[],
  ): SkillAssessmentQuestion[] {
    return questions.map(({ correct_answer: _ignored, ...question }) => ({
      ...question,
      block:
        question.block ?? this.blockForQuestionType(question.question_type),
    }));
  }

  private blockForQuestionType(
    questionType: QuestionType,
  ): AssessmentAnswerBlock {
    if (
      questionType === QuestionType.SINGLE_PICK ||
      questionType === QuestionType.MULTI_PICK
    ) {
      return 'mcq';
    }
    return 'long_text';
  }

  private assertTextLength(
    question: SkillAssessmentSessionQuestion,
    answer: string,
  ): void {
    const block =
      question.block ?? this.blockForQuestionType(question.question_type);
    const bounds = textLengthBoundsForBlock(block);
    if (!bounds) {
      return;
    }

    const trimmed = answer.trim();
    if (!trimmed) {
      if (question.question_type === QuestionType.REQUIRED_TEXT) {
        throw new UnprocessableEntityException(
          `Question ${question.question_number} is required`,
        );
      }
      return;
    }

    if (trimmed.length < bounds.min || trimmed.length > bounds.max) {
      throw new UnprocessableEntityException(
        `Question ${question.question_number} must be between ${bounds.min} and ${bounds.max} characters`,
      );
    }
  }

  private scoreGeneratedMcq(
    question: SkillAssessmentSessionQuestion,
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

  private selectSkillProbeMix(
    bankQuestions: AssessmentQuestion[],
  ): AssessmentQuestion[] {
    const mcqs = bankQuestions
      .filter((question) => this.isPickQuestion(question))
      .slice(0, SKILL_PROBE_MCQ_COUNT);
    const text = bankQuestions
      .filter((question) => !this.isPickQuestion(question))
      .slice(0, SKILL_PROBE_TEXT_COUNT);

    if (
      mcqs.length < SKILL_PROBE_MCQ_COUNT ||
      text.length < SKILL_PROBE_TEXT_COUNT
    ) {
      return [];
    }

    return [...mcqs, ...text];
  }

  private toPercentage(score: number, maxScore: number): number {
    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }

  private toWeightedSectionScore(
    mcqScore: number,
    mcqMaxScore: number,
    textScore: number,
    textMaxScore: number,
    mcqWeight: number,
  ): { score: number; maxScore: number; percentage: number } {
    const hasMcq = mcqMaxScore > 0;
    const hasText = textMaxScore > 0;
    if (!hasMcq && !hasText) {
      return { score: 0, maxScore: 0, percentage: 0 };
    }

    const mcqPercentage = this.toPercentage(mcqScore, mcqMaxScore);
    const textPercentage = this.toPercentage(textScore, textMaxScore);
    let percentage: number;

    if (hasMcq && hasText) {
      percentage = Math.round(
        mcqPercentage * mcqWeight + textPercentage * (1 - mcqWeight),
      );
    } else {
      percentage = hasMcq ? mcqPercentage : textPercentage;
    }

    return {
      score: percentage,
      maxScore: 100,
      percentage,
    };
  }

  private levelAbove(level: VerifiedLevel): VerifiedLevel | null {
    const levels = Object.values(VerifiedLevel);
    const index = levels.indexOf(level);
    if (index < 0 || index >= levels.length - 1) {
      return null;
    }
    return levels[index + 1] ?? null;
  }

  private levelBelowForProbe(level: VerifiedLevel): VerifiedLevel | null {
    const levels = Object.values(VerifiedLevel);
    const index = levels.indexOf(level);
    if (index <= 0) {
      return null;
    }
    return levels[index - 1] ?? null;
  }

  private resolveValidatedLevel(
    claimedPercentage: number,
    aboveLevelPercentage: number,
    belowLevelPercentage: number,
    overallPercentage: number,
    claimedLevel: VerifiedLevel,
    primaryMcqGatePassed = true,
    aboveProbeMcqGatePassed = true,
  ): VerifiedLevel {
    if (overallPercentage < 55) {
      return LEVEL_ORDER[claimedLevel] > LEVEL_ORDER[VerifiedLevel.JUNIOR]
        ? VerifiedLevel.JUNIOR
        : claimedLevel;
    }

    if (
      claimedPercentage >= 95 &&
      aboveLevelPercentage >= 70 &&
      aboveProbeMcqGatePassed &&
      this.levelAbove(claimedLevel)
    ) {
      return this.levelAbove(claimedLevel) as VerifiedLevel;
    }

    if (
      claimedPercentage >= SKILL_ASSESSMENT_PASS_PERCENTAGE &&
      primaryMcqGatePassed
    ) {
      return claimedLevel;
    }

    const belowLevel = this.levelBelowForProbe(claimedLevel);
    if (claimedPercentage < 60 && belowLevelPercentage >= 60 && belowLevel) {
      return belowLevel;
    }

    return this.levelBelow(claimedLevel);
  }

  private levelBelow(level: VerifiedLevel): VerifiedLevel {
    const levels = Object.values(VerifiedLevel);
    const index = levels.indexOf(level);
    return levels[Math.max(0, index - 1)] ?? VerifiedLevel.JUNIOR;
  }

  private resolveSkillTier(percentage: number): TalentProfileStatus {
    if (percentage >= 50) {
      return TalentProfileStatus.EMERGING;
    }
    return TalentProfileStatus.NOT_READY;
  }

  private skillTierToProfileStatus(
    tier: TalentProfileStatus,
    passed: boolean,
  ): TalentProfileStatus {
    if (passed) {
      return TalentProfileStatus.IN_PROGRESS;
    }
    return tier;
  }

  private extractStrongCompetencies(
    scored: ScoredTextAnswer[],
    questionById: Map<string, AssessmentQuestion>,
  ): string[] {
    return this.resolveScoredCompetencies(
      scored.filter(
        (score) =>
          score.max_score > 0 && score.raw_score / score.max_score >= 0.7,
      ),
      questionById,
    );
  }

  private extractWeakCompetencies(
    scored: ScoredTextAnswer[],
    questionById: Map<string, AssessmentQuestion>,
  ): string[] {
    return this.resolveScoredCompetencies(
      scored.filter(
        (score) =>
          score.max_score > 0 && score.raw_score / score.max_score < 0.5,
      ),
      questionById,
    );
  }

  private resolveScoredCompetencies(
    scored: ScoredTextAnswer[],
    questionById: Map<string, AssessmentQuestion>,
  ): string[] {
    const competencies = new Set<string>();
    for (const score of scored) {
      const question = questionById.get(score.question_id);
      const metadata = (question?.metadata ?? {}) as Record<string, unknown>;
      const competency =
        question?.competency ??
        (typeof metadata.competency === 'string' ? metadata.competency : null);

      if (competency?.trim()) {
        competencies.add(competency.trim());
      }
    }

    return [...competencies];
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
        ErrorMessages.SKILL_ASSESSMENT.PROFILE_NOT_FOUND,
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
            assessment_type: AssessmentType.SKILL,
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (!attempt) {
          throw new NotFoundException(
            ErrorMessages.SKILL_ASSESSMENT.ATTEMPT_NOT_FOUND,
          );
        }
        if (attempt.completed_at || attempt.force_submitted) {
          throw new BadRequestException(
            ErrorMessages.SKILL_ASSESSMENT.ATTEMPT_ALREADY_SUBMITTED,
          );
        }

        await manager.increment(
          AssessmentAttempt,
          {
            id: attempt.id,
            talent_profile_id: profile.id,
            assessment_type: AssessmentType.SKILL,
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
            ErrorMessages.SKILL_ASSESSMENT.ATTEMPT_NOT_FOUND,
          );
        }

        await manager.update(
          AssessmentAttempt,
          { id: attempt.id },
          { force_submitted: true, completed_at: new Date() },
        );

        return {
          attemptId: attempt.id,
          tabSwitchCount: updatedAttempt.tab_switch_count,
          copyPasteCount: updatedAttempt.copy_paste_count,
        };
      },
    );

    this.logger.warn(
      `Skill session voided - integrity ${dto.event_type}: attempt=${result.attemptId} user=${userId}`,
    );

    return {
      status: 'voided',
      message: ErrorMessages.SKILL_ASSESSMENT.SESSION_VOIDED,
      tab_switch_count: result.tabSwitchCount,
      copy_paste_count: result.copyPasteCount,
      session_voided: true,
      action: 'logout',
    };
  }
}
