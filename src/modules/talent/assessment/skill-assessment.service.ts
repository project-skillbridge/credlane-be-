import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { SubmitSkillAssessmentDto } from './dto/skill-assessment.dto';
import { ErrorMessages, SuccessMessages } from '../../../shared';
import { SKILL_ASSESSMENT_LEVEL_THRESHOLDS } from '../talent.constants';
import { RubricScoringService } from '../../ai/rubric-scoring.service';



export interface SkillAssessmentQuestion {
  question_id: string;
  question_number: number;
  question_type: QuestionType;
  question_text: string;
  options: string[] | null;
}

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
  ) {}

  // -------------------------------------------------------------------------
  // POST /talent/assessment/skill/start
  // -------------------------------------------------------------------------

  async start(userId: string): Promise<StartSkillAssessmentResult> {

    const profile = await this.talentProfileRepo.findOne({
      where: { user_id: userId },
    });

    if (!profile) {
      throw new NotFoundException(ErrorMessages.SKILL_ASSESSMENT.PROFILE_NOT_FOUND);
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

    const verifiedLevel: VerifiedLevel = profile.claimed_level;

    const questions = await this.questionRepo.find({
      where: {
        assessment_type: AssessmentType.SKILL,
        track: profile.track,
        verified_level: verifiedLevel,
        is_live: true,
      },
      order: { question_number: 'ASC' },
    });

    if (questions.length === 0) {
      this.logger.warn(
        `No live skill questions found for track=${profile.track} level=${verifiedLevel}`,
      );
      throw new UnprocessableEntityException(
        ErrorMessages.SKILL_ASSESSMENT.NO_QUESTIONS_AVAILABLE,
      );
    }

  
    const attempt = this.attemptRepo.create({
      talent_profile_id: profile.id,
      assessment_type: AssessmentType.SKILL,
      started_at: new Date(),
      completed_at: null,
      expires_at: null,
      generated_questions_json: { question_ids: questions.map((q) => q.id) },
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
      questions: questions.map((q) => ({
        question_id: q.id,
        question_number: q.question_number,
        question_type: q.question_type,
        question_text: q.question_text,
        options: q.options,
      })),
    };
  }

  // -------------------------------------------------------------------------
  // POST /talent/assessment/skill/submit
  // -------------------------------------------------------------------------

  async submit(
    userId: string,
    dto: SubmitSkillAssessmentDto,
  ): Promise<SubmitSkillAssessmentResult> {
    const profile = await this.talentProfileRepo.findOne({
      where: { user_id: userId },
    });
    if (!profile) {
      throw new NotFoundException(ErrorMessages.SKILL_ASSESSMENT.PROFILE_NOT_FOUND);
    }

    const attempt = await this.attemptRepo.findOne({
      where: {
        id: dto.attempt_id,
        talent_profile_id: profile.id,
        assessment_type: AssessmentType.SKILL,
      },
    });
    if (!attempt) {
      throw new NotFoundException(ErrorMessages.SKILL_ASSESSMENT.ATTEMPT_NOT_FOUND);
    }
    if (attempt.completed_at) {
      throw new BadRequestException(
        ErrorMessages.SKILL_ASSESSMENT.ATTEMPT_ALREADY_SUBMITTED,
      );
    }

    const sessionQuestionIds: string[] =
      (attempt.generated_questions_json as { question_ids: string[] })
        ?.question_ids ?? [];

    if (sessionQuestionIds.length === 0) {
      throw new BadRequestException(ErrorMessages.SKILL_ASSESSMENT.ATTEMPT_CORRUPT);
    }

    const questions = await this.questionRepo.findByIds(sessionQuestionIds);
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    let mcqCorrect = 0;
    let mcqTotal = 0;
    const textAnswers: Array<{
      question: AssessmentQuestion;
      answer: string;
    }> = [];

    const responsesToSave: Partial<AssessmentResponse>[] = [];
    const historyToSave: Partial<TalentQuestionHistory>[] = [];

    for (const ans of dto.answers) {
      const question = questionMap.get(ans.question_id);
      if (!question) {
        continue;
      }

      const isMcq =
        question.question_type === QuestionType.SINGLE_PICK ||
        question.question_type === QuestionType.MULTI_PICK;

      let isCorrect: boolean | null = null;

      if (isMcq) {
        mcqTotal++;
        const userAnswer = Array.isArray(ans.answer)
          ? ans.answer.join(',').toLowerCase()
          : String(ans.answer).toLowerCase();
        const correctAnswer = (question.correct_answer ?? '').toLowerCase();
        isCorrect = userAnswer === correctAnswer;
        if (isCorrect) mcqCorrect++;
      } else {
        textAnswers.push({ question, answer: String(ans.answer) });
      }

      responsesToSave.push({
        attempt_id: attempt.id,
        question_id: question.id,
        user_answer: ans.answer,
        is_correct: isCorrect,
        answered_at: new Date(),
      });

      historyToSave.push({
        talent_profile_id: profile.id,
        question_id: question.id,
        attempt_id: attempt.id,
        user_answer: ans.answer,
        is_correct: isCorrect,
        raw_score: isCorrect === null ? null : isCorrect ? 1 : 0,
        max_score: isCorrect === null ? null : 1,
        answered_at: new Date(),
      });
    }

    // AI rubric scoring for text answers
    const scoredTextAnswers = await this.rubricScoring.scoreAnswers(
      textAnswers.map(({ question, answer }) => ({
        question_id: question.id,
        question_text: question.question_text,
        answer,
      })),
    );

    let textScore = 0;
    let textMaxScore = 0;

    for (const scored of scoredTextAnswers) {
      textScore += scored.raw_score;
      textMaxScore += scored.max_score;

      const historyEntry = historyToSave.find(
        (h) => h.question_id === scored.question_id,
      );
      if (historyEntry) {
        historyEntry.raw_score = scored.raw_score;
        historyEntry.max_score = scored.max_score;
      }
    }

    const totalScore = mcqCorrect + textScore;
    const totalMaxScore = mcqTotal + textMaxScore;
    const percentage = totalMaxScore > 0
      ? Math.round((totalScore / totalMaxScore) * 100)
      : 0;

    const validatedLevel = this.resolveValidatedLevel(
      percentage,
      profile.claimed_level!,
    );

    const claimed = profile.claimed_level!;
    const downgraded = levelIsLower(validatedLevel, claimed);

    await this.talentProfileRepo.manager.transaction(async (manager) => {
      await manager.save(AssessmentResponse, responsesToSave);
      await manager.save(TalentQuestionHistory, historyToSave);

      attempt.completed_at = new Date();
      await manager.save(AssessmentAttempt, attempt);

      const result = manager.create(AssessmentResult, {
        attempt_id: attempt.id,
        score: Math.round(totalScore),
        max_score: totalMaxScore,
        percentage,
        validated_level: validatedLevel,
        tier: null,
      });
      await manager.save(AssessmentResult, result);

      await manager.update(
        TalentProfile,
        { id: profile.id },
        {
          validated_level: validatedLevel,
          skill_assessment_completed_at: new Date(),
          status: TalentProfileStatus.JOB_READY,
        },
      );
    });

    this.logger.log(
      `Skill assessment submitted: attempt=${attempt.id} user=${userId} score=${totalScore}/${totalMaxScore} validated=${validatedLevel} downgraded=${downgraded}`,
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
      ...(downgraded && {
        personalised_message: SuccessMessages.SKILL_ASSESSMENT.DOWNGRADE_NOTICE,
      }),
    };
  }


  private resolveValidatedLevel(
    percentage: number,
    claimedLevel: VerifiedLevel,
  ): VerifiedLevel {

    const thresholds = SKILL_ASSESSMENT_LEVEL_THRESHOLDS;

    let rawLevel = VerifiedLevel.ENTRY;
    for (const threshold of thresholds) {
      if (percentage >= threshold.min) {
        rawLevel = threshold.level;
        break;
      }
    }

    // Do NOT promote above claimed level — only validate or downgrade
    if (LEVEL_ORDER[rawLevel] > LEVEL_ORDER[claimedLevel]) {
      return claimedLevel;
    }

    return rawLevel;
  }
}
