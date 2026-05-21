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
import { EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import {
  AssessmentAttempt,
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentResult,
  AssessmentType,
  QuestionType,
  SlotType,
  TalentQuestionHistory,
  VerifiedLevel,
} from '../../assessments/entities';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../entities/talent-profile.entity';
import { SubmitSkillAssessmentDto } from './dto/skill-assessment.dto';
import { ErrorMessages, SuccessMessages } from '../../../shared';
import {
  SKILL_ASSESSMENT_LEVEL_THRESHOLDS,
  SKILL_ASSESSMENT_MAX_ATTEMPTS,
} from '../talent.constants';
import { RubricScoringService } from '../../ai/rubric-scoring.service';
import { GuidanceReportService } from '../../ai/guidance-report.service';
import { QuestionGenerationService } from '../../ai/question-generation.service';
import { GuidanceReport, ScoredTextAnswer } from '../../ai/ai.types';
import { PersonalAssessmentService } from './personal-assessment.service';
import {
  metadataDifficulty,
  resolveCompetencyHint,
  resolveIndustryContext,
} from './assessment-utils';

const SKILL_ASSESSMENT_MCQ_COUNT = 6;
const SKILL_ASSESSMENT_TEXT_COUNT = 4;
const SKILL_ASSESSMENT_PASS_PERCENTAGE = 75;

export interface SkillAssessmentQuestion {
  question_id: string;
  question_number: number;
  question_type: QuestionType;
  question_text: string;
  options: string[] | null;
}

type SkillAssessmentSessionQuestion = SkillAssessmentQuestion & {
  correct_answer: string | null;
};

type SkillAssessmentSessionPayload = {
  context?: {
    verified_level?: VerifiedLevel;
  };
  questions?: SkillAssessmentSessionQuestion[];
};

export interface StartSkillAssessmentResult {
  status: string;
  message: string;
  attempt_id: string;
  session_id: string;
  verified_level: VerifiedLevel;
  questions: SkillAssessmentQuestion[];
}

export interface SkillAssessmentSessionResult {
  status: string;
  message: string;
  attempt_id: string;
  session_id: string;
  started_at: string;
  verified_level: VerifiedLevel;
  questions: SkillAssessmentQuestion[];
}

export interface SubmitSkillAssessmentResult {
  status: string;
  message: string;
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
  [VerifiedLevel.ENTRY]: 0,
  [VerifiedLevel.JUNIOR]: 1,
  [VerifiedLevel.MID]: 2,
  [VerifiedLevel.SENIOR]: 3,
  [VerifiedLevel.EXPERT]: 4,
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
    private readonly personalAssessmentService: PersonalAssessmentService,
  ) {}

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
    // block start if max of 3 is reached
    await this.assertSkillAssessmentAttemptsRemaining(profile);

    const verifiedLevel = profile.claimed_level;
    const personalContext =
      await this.personalAssessmentService.getAiContext(userId);
    const industryContext = resolveIndustryContext(personalContext);
    const competencyHint = resolveCompetencyHint(personalContext);

    const [generatedMcqs, generatedTexts] = await Promise.all([
      this.questionGeneration.generateQuestions({
        track: profile.track,
        verified_level: verifiedLevel,
        assessment_type: 'skill',
        question_type: QuestionType.SINGLE_PICK,
        slot_type: SlotType.WORK_TASK,
        competency: competencyHint,
        industry_context: industryContext,
        count: SKILL_ASSESSMENT_MCQ_COUNT,
      }),
      this.questionGeneration.generateQuestions({
        track: profile.track,
        verified_level: verifiedLevel,
        assessment_type: 'skill',
        question_type: QuestionType.REQUIRED_TEXT,
        slot_type: SlotType.SITUATIONAL,
        competency: competencyHint,
        industry_context: industryContext,
        count: SKILL_ASSESSMENT_TEXT_COUNT,
      }),
    ]);

    const savedQuestions = await this.persistGeneratedQuestions(
      profile.track,
      verifiedLevel,
      [...generatedMcqs, ...generatedTexts],
    );

    const orderedQuestions = savedQuestions.map((question, index) => ({
      question_id: question.id,
      question_number: index + 1,
      question_type: question.question_type,
      question_text: question.question_text,
      options: question.options,
      correct_answer: question.correct_answer,
    }));

    const savedAttempt = await this.talentProfileRepo.manager.transaction(
      async (manager) => {
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

        const attempt = manager.create(AssessmentAttempt, {
          talent_profile_id: lockedProfile.id,
          assessment_type: AssessmentType.SKILL,
          started_at: new Date(),
          completed_at: null,
          expires_at: null,
          generated_questions_json: {
            context: { verified_level: verifiedLevel },
            questions: orderedQuestions,
          },
        });

        return manager.save(AssessmentAttempt, attempt);
      },
    );

    this.logger.log(
      `Skill assessment started: attempt=${savedAttempt.id} user=${userId} track=${profile.track} level=${verifiedLevel}`,
    );

    return {
      status: 'success',
      message: SuccessMessages.SKILL_ASSESSMENT.STARTED,
      attempt_id: savedAttempt.id,
      session_id: savedAttempt.id,
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

    return {
      status: 'success',
      message: SuccessMessages.SKILL_ASSESSMENT.SESSION_RESUMED,
      attempt_id: attempt.id,
      session_id: attempt.id,
      started_at: attempt.started_at.toISOString(),
      verified_level:
        payload.context?.verified_level ??
        profile.claimed_level ??
        VerifiedLevel.ENTRY,
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

    let mcqCorrect = 0;
    let mcqTotal = 0;
    const textAnswers: Array<{
      question: SkillAssessmentSessionQuestion;
      answer: string;
    }> = [];
    const responsesToSave: Partial<AssessmentResponse>[] = [];
    const historyToSave: Partial<TalentQuestionHistory>[] = [];

    for (const question of sessionQuestions) {
      const submitted = answerMap.get(question.question_id);
      const isMcq =
        question.question_type === QuestionType.SINGLE_PICK ||
        question.question_type === QuestionType.MULTI_PICK;

      let isCorrect: boolean | null = null;
      if (isMcq) {
        mcqTotal++;
        isCorrect = this.scoreGeneratedMcq(question, submitted?.answer ?? null);
        if (isCorrect) {
          mcqCorrect++;
        }
      } else {
        const answer = submitted ? String(submitted.answer) : '';
        textAnswers.push({ question, answer });
      }

      responsesToSave.push({
        attempt_id: attempt.id,
        question_id: entityMap.get(question.question_id)?.id ?? null,
        question_text: question.question_text,
        user_answer: submitted?.answer ?? null,
        is_correct: isCorrect,
        answered_at: new Date(),
      });

      if (entityMap.has(question.question_id)) {
        historyToSave.push({
          talent_profile_id: profile.id,
          question_id: question.question_id,
          attempt_id: attempt.id,
          user_answer: submitted?.answer ?? null,
          is_correct: isCorrect,
          raw_score: isCorrect === null ? null : isCorrect ? 1 : 0,
          max_score: isCorrect === null ? null : 1,
          answered_at: new Date(),
        });
      }
    }

    const scoredTextAnswers = await this.rubricScoring.scoreAnswers(
      textAnswers.map(({ question, answer }) => ({
        question_id: question.question_id,
        question_text: question.question_text,
        answer,
      })),
    );

    let textScore = 0;
    let textMaxScore = 0;
    for (const scored of scoredTextAnswers) {
      textScore += scored.raw_score;
      textMaxScore += scored.max_score;

      const response = responsesToSave.find(
        (entry) => entry.question_id === scored.question_id,
      );
      if (response) {
        response.ai_evaluation_json = { ...scored.rubric };
      }

      const historyEntry = historyToSave.find(
        (entry) => entry.question_id === scored.question_id,
      );
      if (historyEntry) {
        historyEntry.raw_score = scored.raw_score;
        historyEntry.max_score = scored.max_score;
      }
    }

    const totalScore = mcqCorrect + textScore;
    const totalMaxScore = mcqTotal + textMaxScore;
    const percentage =
      totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

    const validatedLevel = this.resolveValidatedLevel(
      percentage,
      profile.claimed_level ?? VerifiedLevel.ENTRY,
    );
    const claimed = profile.claimed_level ?? VerifiedLevel.ENTRY;
    const downgraded = levelIsLower(validatedLevel, claimed);
    const passed = percentage >= SKILL_ASSESSMENT_PASS_PERCENTAGE;
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
            scoredTextAnswers,
            entityMap,
          ),
          weak_competencies: this.extractWeakCompetencies(
            scoredTextAnswers,
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
      if (historyToSave.length > 0) {
        await manager.save(TalentQuestionHistory, historyToSave);
      }

      attempt.completed_at = new Date();
      await manager.save(AssessmentAttempt, attempt);

      const result = manager.create(AssessmentResult, {
        attempt_id: attempt.id,
        score: Math.round(totalScore),
        max_score: totalMaxScore,
        percentage,
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

    return {
      status: 'success',
      message: SuccessMessages.SKILL_ASSESSMENT.SUBMITTED,
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

  private async persistGeneratedQuestions(
    track: string,
    verifiedLevel: VerifiedLevel,
    generated: Array<{
      question_text: string;
      question_type: QuestionType;
      slot_type: SlotType | null;
      options: string[] | null;
      correct_answer: string | null;
      competency: string | null;
      industry_context: string | null;
    }>,
  ): Promise<AssessmentQuestion[]> {
    const nextQuestionNumber = await this.nextSkillQuestionNumber();

    const questions = generated.map((question, index) =>
      this.questionRepo.create({
        assessment_type: AssessmentType.SKILL,
        question_type: question.question_type,
        question_text: question.question_text,
        question_number: nextQuestionNumber + index,
        options: question.options,
        correct_answer: question.correct_answer,
        track,
        verified_level: verifiedLevel,
        competency: question.competency ?? 'general',
        slot_type: null,
        metadata: this.buildGeneratedQuestionMetadata({
          track,
          verifiedLevel,
          questionType: question.question_type,
          competency: question.competency ?? 'general',
          slotType: question.slot_type,
          industryContext: question.industry_context,
        }),
        is_live: false,
      }),
    );

    return this.questionRepo.save(questions);
  }

  private buildGeneratedQuestionMetadata(input: {
    track: string;
    verifiedLevel: VerifiedLevel;
    questionType: QuestionType;
    competency: string | null;
    slotType: SlotType | null;
    industryContext: string | null;
  }): Record<string, unknown> {
    const isTextQuestion =
      input.questionType === QuestionType.REQUIRED_TEXT ||
      input.questionType === QuestionType.OPTIONAL_TEXT;

    return {
      difficulty: metadataDifficulty(input.verifiedLevel),
      estimated_time_seconds: isTextQuestion ? 300 : 90,
      tags: [
        'generated',
        'skill',
        input.track,
        input.verifiedLevel,
        input.competency,
        input.slotType,
      ].filter((tag): tag is string => Boolean(tag)),
      generated: true,
      industry_context: input.industryContext,
      slot_type: input.slotType,
    };
  }

  private async nextSkillQuestionNumber(): Promise<number> {
    const row = await this.questionRepo
      .createQueryBuilder('question')
      .select('MAX(question.question_number)', 'max')
      .where('question.assessment_type = :assessmentType', {
        assessmentType: AssessmentType.SKILL,
      })
      .getRawOne<{ max: string | null }>();

    return Number(row?.max ?? 0) + 1;
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
    }));
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

  private resolveValidatedLevel(
    percentage: number,
    claimedLevel: VerifiedLevel,
  ): VerifiedLevel {
    let rawLevel = VerifiedLevel.ENTRY;
    for (const threshold of SKILL_ASSESSMENT_LEVEL_THRESHOLDS) {
      if (percentage >= threshold.min) {
        rawLevel = threshold.level;
        break;
      }
    }

    if (LEVEL_ORDER[rawLevel] > LEVEL_ORDER[claimedLevel]) {
      return claimedLevel;
    }

    return rawLevel;
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
}
