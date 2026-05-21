import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import {
  BadRequestError,
  ErrorMessages,
  ForbiddenError,
  NotFoundError,
} from '../../shared';
import {
  AssessmentAttempt,
  AssessmentResponse,
  AssessmentResult,
  AssessmentTier,
  AssessmentType,
  VerifiedLevel,
} from '../assessments/entities';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../talent/entities/talent-profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import type { AdvancedAssessmentGeneratedQuestion } from '../talent/assessment/advanced-assessment-ai.service';
import type { VerifiedProfileResponseDto } from './dto/verified-profile.dto';
import {
  readPersonalAnswers,
  readSessionQuestions,
  resolveGoalLabel,
  resolveRoleLabel,
  resolveSkills,
  rubricScorePercentage,
} from './verified-profile.utils';

type BlockAggregate = { total: number; count: number };

const SHARE_LINK_TOKEN_PATTERN = /^[a-fA-F0-9]{64}$/;

export type VerifiedProfileResponse = VerifiedProfileResponseDto;

@Injectable()
export class VerifiedProfileService {
  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepository: Repository<TalentProfile>,
    @InjectRepository(EmployerPoolProfile)
    private readonly employerPoolRepository: Repository<EmployerPoolProfile>,
    @InjectRepository(AssessmentResult)
    private readonly assessmentResultRepository: Repository<AssessmentResult>,
    @InjectRepository(AssessmentAttempt)
    private readonly assessmentAttemptRepository: Repository<AssessmentAttempt>,
    @InjectRepository(AssessmentResponse)
    private readonly assessmentResponseRepository: Repository<AssessmentResponse>,
    private readonly usersService: UsersService,
  ) {}

  async getForTalentUser(userId: string): Promise<VerifiedProfileResponse> {
    const user = await this.usersService.findOne(userId);

    if (user.role !== UserRole.TALENT) {
      throw new ForbiddenError(ErrorMessages.COMMON.INSUFFICIENT_PERMISSIONS);
    }

    const profile = await this.talentProfileRepository.findOne({
      where: { user_id: userId },
    });

    if (!profile) {
      throw new NotFoundError(ErrorMessages.VERIFIED_PROFILE.NOT_AVAILABLE);
    }

    return this.buildVerifiedProfile(user, profile);
  }

  async getByShareToken(token: string): Promise<VerifiedProfileResponse> {
    if (!SHARE_LINK_TOKEN_PATTERN.test(token)) {
      throw new BadRequestError(ErrorMessages.VERIFIED_PROFILE.INVALID_TOKEN);
    }

    const poolProfile = await this.employerPoolRepository.findOne({
      where: { shareable_link_token: token },
      relations: ['talent_profile'],
    });

    if (!poolProfile?.talent_profile) {
      throw new NotFoundError(ErrorMessages.VERIFIED_PROFILE.NOT_FOUND);
    }

    const user = await this.usersService.findOne(poolProfile.candidate_id);
    return this.buildVerifiedProfile(
      user,
      poolProfile.talent_profile,
      poolProfile,
    );
  }

  private async buildVerifiedProfile(
    user: User,
    profile: TalentProfile,
    poolProfile?: EmployerPoolProfile | null,
  ): Promise<VerifiedProfileResponse> {
    const latestAdvancedResult = await this.getLatestAdvancedResult(profile.id);

    if (!this.isJobReady(profile, latestAdvancedResult)) {
      throw new NotFoundError(ErrorMessages.VERIFIED_PROFILE.NOT_AVAILABLE);
    }

    const personalAnswers = readPersonalAnswers(
      profile.personal_assessment_answers,
    );
    const latestSkillResult = await this.getLatestSkillResult(profile.id);
    const blockScores = await this.resolveAdvancedBlockScores(profile.id);

    const validatedLevel =
      profile.validated_level ??
      (poolProfile?.verified_level as VerifiedLevel | undefined) ??
      VerifiedLevel.ENTRY;

    const skillProficiency =
      validatedLevel != null
        ? {
            validatedLevel,
            ...(latestSkillResult?.percentage != null && {
              skillAssessmentPercentage: latestSkillResult.percentage,
            }),
          }
        : undefined;

    const verifiedAt = this.resolveVerifiedAt(
      poolProfile,
      profile,
      latestAdvancedResult,
    );

    const skills = resolveSkills(personalAnswers);

    return {
      fullName: `${user.first_name} ${user.last_name}`.trim(),
      role: resolveRoleLabel(
        profile.track,
        profile.role_track,
        poolProfile?.specialization ?? null,
        personalAnswers,
      ),
      goal: resolveGoalLabel(profile.goal),
      about: profile.bio?.trim() ?? '',
      ...(skills && { skills }),
      ...(skillProficiency && { skillProficiency }),
      ...(blockScores.workplaceReadiness && {
        workplaceReadiness: blockScores.workplaceReadiness,
      }),
      ...(blockScores.practicalApplication && {
        practicalApplication: blockScores.practicalApplication,
      }),
      verifiedAt: verifiedAt.toISOString(),
      ...(latestAdvancedResult?.tier && { tier: latestAdvancedResult.tier }),
    };
  }

  private isJobReady(
    profile: TalentProfile,
    latestAdvancedResult: AssessmentResult | null,
  ): boolean {
    return (
      profile.status === TalentProfileStatus.JOB_READY ||
      latestAdvancedResult?.tier === AssessmentTier.JOB_READY
    );
  }

  private resolveVerifiedAt(
    poolProfile: EmployerPoolProfile | null | undefined,
    profile: TalentProfile,
    latestAdvancedResult: AssessmentResult | null,
  ): Date {
    const verifiedAt =
      poolProfile?.verified_at ??
      profile.advanced_assessment_completed_at ??
      latestAdvancedResult?.created_at;

    if (!verifiedAt) {
      throw new NotFoundError(
        ErrorMessages.VERIFIED_PROFILE.TIMESTAMP_UNAVAILABLE,
      );
    }

    return verifiedAt;
  }

  private async getLatestAdvancedResult(
    talentProfileId: string,
  ): Promise<AssessmentResult | null> {
    return this.assessmentResultRepository
      .createQueryBuilder('result')
      .innerJoin('result.attempt', 'attempt')
      .where('attempt.talent_profile_id = :talentProfileId', {
        talentProfileId,
      })
      .andWhere('attempt.assessment_type = :assessmentType', {
        assessmentType: AssessmentType.ADVANCED,
      })
      .andWhere('attempt.completed_at IS NOT NULL')
      .orderBy('attempt.completed_at', 'DESC')
      .addOrderBy('result.created_at', 'DESC')
      .getOne();
  }

  private async getLatestSkillResult(
    talentProfileId: string,
  ): Promise<AssessmentResult | null> {
    return this.assessmentResultRepository
      .createQueryBuilder('result')
      .innerJoin('result.attempt', 'attempt')
      .where('attempt.talent_profile_id = :talentProfileId', {
        talentProfileId,
      })
      .andWhere('attempt.assessment_type = :assessmentType', {
        assessmentType: AssessmentType.SKILL,
      })
      .andWhere('attempt.completed_at IS NOT NULL')
      .orderBy('attempt.completed_at', 'DESC')
      .addOrderBy('result.created_at', 'DESC')
      .getOne();
  }

  private async resolveAdvancedBlockScores(talentProfileId: string): Promise<{
    workplaceReadiness?: { percentage: number; label: string };
    practicalApplication?: { percentage: number; label: string };
  }> {
    const attempt = await this.assessmentAttemptRepository.findOne({
      where: {
        talent_profile_id: talentProfileId,
        assessment_type: AssessmentType.ADVANCED,
        completed_at: Not(IsNull()),
      },
      order: { completed_at: 'DESC' },
    });

    if (!attempt) {
      return {};
    }

    const sessionQuestions = readSessionQuestions(
      attempt.generated_questions_json,
    );
    if (sessionQuestions.length === 0) {
      return {};
    }

    const questionById = new Map(
      sessionQuestions.map((question) => [question.question_id, question]),
    );
    const lt3QuestionId = this.resolveLt3QuestionId(sessionQuestions);

    const responses = await this.assessmentResponseRepository.find({
      where: { attempt_id: attempt.id },
    });

    const shortText = { total: 0, count: 0 };
    const longText = { total: 0, count: 0 };

    for (const response of responses) {
      const questionId = response.question_id;
      if (!questionId) {
        continue;
      }

      const question = questionById.get(questionId);
      if (!question) {
        continue;
      }

      if (question.block === 'short_text') {
        const pct = this.scoreTextResponse(
          response,
          questionId === lt3QuestionId,
        );
        if (pct != null) {
          this.addToAggregate(shortText, pct);
        }
        continue;
      }

      if (question.block === 'long_text') {
        const pct = this.scoreTextResponse(
          response,
          questionId === lt3QuestionId,
        );
        if (pct != null) {
          this.addToAggregate(longText, pct);
        }
      }
    }

    const workplaceReadiness = this.toDimensionScore(
      shortText,
      'Workplace Readiness',
    );
    const practicalApplication = this.toDimensionScore(
      longText,
      'Practical Application',
    );

    return {
      ...(workplaceReadiness && { workplaceReadiness }),
      ...(practicalApplication && { practicalApplication }),
    };
  }

  private resolveLt3QuestionId(
    questions: AdvancedAssessmentGeneratedQuestion[],
  ): string | null {
    const longText = questions.filter((q) => q.block === 'long_text');
    return longText[longText.length - 1]?.question_id ?? null;
  }

  private scoreTextResponse(
    response: AssessmentResponse,
    isLt3: boolean,
  ): number | null {
    const evaluation = response.ai_evaluation_json;
    if (evaluation && typeof evaluation === 'object') {
      return rubricScorePercentage(evaluation, isLt3);
    }
    return null;
  }

  private addToAggregate(aggregate: BlockAggregate, percentage: number): void {
    aggregate.total += percentage;
    aggregate.count += 1;
  }

  private toDimensionScore(
    aggregate: BlockAggregate,
    label: string,
  ): { percentage: number; label: string } | undefined {
    if (aggregate.count === 0) {
      return undefined;
    }

    return {
      label,
      percentage: Math.round(aggregate.total / aggregate.count),
    };
  }
}
