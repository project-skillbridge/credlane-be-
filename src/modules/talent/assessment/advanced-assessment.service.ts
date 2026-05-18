import {
  ConflictException,
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
  AssessmentType,
  QuestionType,
  TalentQuestionHistory,
} from '../../assessments/entities';
import { ErrorMessages, SuccessMessages } from '../../../shared';
import { TalentProfile } from '../entities/talent-profile.entity';
import {
  ADVANCED_ASSESSMENT_LONG_TEXT_COUNT,
  ADVANCED_ASSESSMENT_MCQ_COUNT,
  ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT,
  ADVANCED_ASSESSMENT_TOTAL_QUESTIONS,
  AdvancedAssessmentAiService,
  AdvancedAssessmentGeneratedQuestion,
} from './advanced-assessment-ai.service';
import { PersonalAssessmentService } from './personal-assessment.service';

const ADVANCED_ASSESSMENT_DURATION_MINUTES = 90;

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

        if (!profile.validated_level) {
          throw new UnprocessableEntityException({
            error: 'LEVEL_NOT_VERIFIED',
            message: ErrorMessages.ADVANCED_ASSESSMENT.LEVEL_NOT_VERIFIED,
          });
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
          .andWhere(
            '(attempt.expires_at IS NULL OR attempt.expires_at > :now)',
            {
              now: new Date(),
            },
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

    if (marker.includes('long')) {
      return 'long_text';
    }
    if (marker.includes('short')) {
      return 'short_text';
    }

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
    const verifiedLevel = this.readSessionPayload(attempt).context
      ?.verified_level;
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
