import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
import { SKILL_ASSESSMENT_LEVEL_THRESHOLDS } from '../talent.constants';
import { RubricScoringService } from '../../ai/rubric-scoring.service';
import { GuidanceReportService } from '../../ai/guidance-report.service';
import { QuestionGenerationService } from '../../ai/question-generation.service';
import { GuidanceReport, ScoredTextAnswer } from '../../ai/ai.types';
import { PersonalAssessmentService } from './personal-assessment.service';

const SKILL_ASSESSMENT_MCQ_COUNT = 6;
const SKILL_ASSESSMENT_TEXT_COUNT = 4;
const SKILL_ASSESSMENT_PASS_PERCENTAGE = 75;
const SKILL_ASSESSMENT_RETAKE_DAYS = 14;

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
  retry_available_at?: string;
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

    const verifiedLevel = profile.claimed_level;
    const personalContext =
      await this.personalAssessmentService.getAiContext(userId);
    const industryContext = this.resolveIndustryContext(personalContext);
    const competencyHint = this.resolveCompetencyHint(personalContext);

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

    const attempt = this.attemptRepo.create({
      talent_profile_id: profile.id,
      assessment_type: AssessmentType.SKILL,
      started_at: new Date(),
      completed_at: null,
      expires_at: null,
      generated_questions_json: {
        context: { verified_level: verifiedLevel },
        questions: orderedQuestions,
      },
    });
    const savedAttempt = await this.attemptRepo.save(attempt);

    this.logger.log(
      `Skill assessment started: attempt=${savedAttempt.id} user=${userId} track=${profile.track} level=${verifiedLevel}`,
    );

    return {
      status: 'success',
      message: SuccessMessages.SKILL_ASSESSMENT.STARTED,
      attempt_id: savedAttempt.id,
      verified_level: verifiedLevel,
      questions: orderedQuestions.map(({ correct_answer: _ignored, ...question }) => question),
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
    const entityMap = new Map(questionEntities.map((question) => [question.id, question]));
    const answerMap = new Map(dto.answers.map((answer) => [answer.question_id, answer]));

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
      totalMaxScore > 0
        ? Math.round((totalScore / totalMaxScore) * 100)
        : 0;

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
          track: profile.track ?? 'general',
          claimed_level: claimed,
          validated_level: validatedLevel,
          percentage,
          strong_competencies: this.extractStrongCompetencies(scoredTextAnswers),
          weak_competencies: this.extractWeakCompetencies(scoredTextAnswers),
        });
      } catch (error) {
        this.logger.warn(
          `Skill guidance report generation failed: ${String(error)}`,
        );
      }
    }

    let retryAvailableAt: Date | null = null;
    if (!passed) {
      retryAvailableAt = new Date();
      retryAvailableAt.setDate(
        retryAvailableAt.getDate() + SKILL_ASSESSMENT_RETAKE_DAYS,
      );
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
          assessment_locked_until: retryAvailableAt,
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
      ...(retryAvailableAt && {
        retry_available_at: retryAvailableAt.toISOString(),
      }),
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
        competency: question.competency,
        slot_type: question.slot_type,
        metadata: {
          generated: true,
          industry_context: question.industry_context,
        },
        is_live: false,
      }),
    );

    return this.questionRepo.save(questions);
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

  private resolveIndustryContext(
    context: Record<string, unknown>,
  ): string | undefined {
    const industries = context['industries'];
    if (Array.isArray(industries) && industries.length > 0) {
      return industries.map(String).join(', ');
    }

    const jobTitle = context['job_title'];
    return typeof jobTitle === 'string' && jobTitle.trim().length > 0
      ? jobTitle.trim()
      : undefined;
  }

  private resolveCompetencyHint(
    context: Record<string, unknown>,
  ): string | undefined {
    const specialization = context['specialization'];
    if (typeof specialization === 'string' && specialization.trim().length > 0) {
      return specialization.trim();
    }

    const primaryToolDuration = context['primary_tool_duration'];
    return typeof primaryToolDuration === 'string'
      ? primaryToolDuration
      : undefined;
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
    return Array.isArray(questions)
      ? (questions as SkillAssessmentSessionQuestion[])
      : [];
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
    const correctAnswer = String(question.correct_answer)
      .toLowerCase()
      .trim();

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
}
