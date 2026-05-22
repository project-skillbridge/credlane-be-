import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { z } from 'zod';
import { env } from '../../config/env';
import {
  BadRequestError,
  ErrorMessages,
  ForbiddenError,
  NotFoundError,
} from '../../shared';
import { OpenRouterService } from '../ai/openrouter.service';
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
  buildQrCodeUrl,
  buildShareUrl,
  categorizeCompetencies,
  readPersonalAnswers,
  readSessionQuestions,
  resolveGoalLabel,
  resolveKeyStrengths,
  resolveRoleLabel,
  resolveSeniorityBadge,
  resolveSkills,
  resolveTierLabel,
  rubricScorePercentage,
} from './verified-profile.utils';

type BlockAggregate = { total: number; count: number };

const SHARE_LINK_TOKEN_PATTERN = /^[a-fA-F0-9]{64}$/;

const AI_SUMMARY_SCHEMA = z.object({
  summary: z
    .string()
    .min(1)
    .describe('3-4 sentence third-person professional summary for employers'),
});

const AI_SUMMARY_SYSTEM_PROMPT = `You are a professional CV writer creating a concise, third-person candidate summary for employer audiences.
Write 3-4 sentences highlighting the candidate's validated skills, experience, and assessment performance.
Be specific, factual, and professional. Return ONLY valid JSON.`;

export type VerifiedProfileResponse = VerifiedProfileResponseDto;

@Injectable()
export class VerifiedProfileService {
  private readonly logger = new Logger(VerifiedProfileService.name);

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
    private readonly openRouterService: OpenRouterService,
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

    const poolProfile = await this.employerPoolRepository.findOne({
      where: { talent_profile_id: profile.id },
    });

    return this.buildVerifiedProfile(user, profile, poolProfile, true);
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
      false,
    );
  }

  private async buildVerifiedProfile(
    user: User,
    profile: TalentProfile,
    poolProfile?: EmployerPoolProfile | null,
    isOwner?: boolean,
  ): Promise<VerifiedProfileResponse> {
    if (!profile.personal_assessment_completed_at) {
      throw new NotFoundError(
        ErrorMessages.ADVANCED_ASSESSMENT.PERSONAL_ASSESSMENT_INCOMPLETE,
      );
    }

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
      VerifiedLevel.JUNIOR;

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
    const seniorityBadge = resolveSeniorityBadge(validatedLevel);
    const tierLabel = resolveTierLabel(
      latestAdvancedResult?.tier ?? poolProfile?.tier ?? null,
    );
    const scorePercentage = latestAdvancedResult?.percentage ?? undefined;

    const competencyScores =
      poolProfile?.competency_scores ?? undefined;
    const strongCompetencies =
      poolProfile?.strong_competencies ?? undefined;

    const keyStrengths = resolveKeyStrengths(
      competencyScores,
      strongCompetencies,
    );
    const { professionalSkills, softSkills } =
      categorizeCompetencies(competencyScores);

    const shareUrl = buildShareUrl(
      env.FRONTEND_URL,
      poolProfile?.shareable_link_token ?? profile.profile_share_link,
    );
    const qrCodeUrl = buildQrCodeUrl(shareUrl);

    let aiSummary: string | undefined;
    if (latestAdvancedResult) {
      aiSummary = await this.generateAiSummary(
        user,
        profile,
        latestAdvancedResult,
        latestSkillResult,
        poolProfile,
      );
    }

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
      ...(aiSummary && { aiSummary }),
      avatarUrl: user.avatar_url,
      verified: true,
      status: profile.status,
      ...(seniorityBadge && { seniorityBadge }),
      ...(skills && { skills }),
      ...(tierLabel && { tierLabel }),
      ...(scorePercentage !== undefined && { scorePercentage }),
      ...(keyStrengths && { keyStrengths }),
      ...(professionalSkills && { professionalSkills }),
      ...(softSkills && { softSkills }),
      ...(skillProficiency && { skillProficiency }),
      ...(blockScores.workplaceReadiness && {
        workplaceReadiness: blockScores.workplaceReadiness,
      }),
      ...(blockScores.practicalApplication && {
        practicalApplication: blockScores.practicalApplication,
      }),
      shareUrl,
      ...(qrCodeUrl && { qrCodeUrl }),
      isOwner: isOwner ?? false,
      verifiedAt: verifiedAt.toISOString(),
      ...(latestAdvancedResult?.tier && { tier: latestAdvancedResult.tier }),
    };
  }

  private async generateAiSummary(
    user: User,
    profile: TalentProfile,
    advancedResult: AssessmentResult,
    skillResult: AssessmentResult | null,
    poolProfile?: EmployerPoolProfile | null,
  ): Promise<string | undefined> {
    if (!env.OPENROUTER_API_KEY) return undefined;

    const fullName = `${user.first_name} ${user.last_name}`.trim();
    const role = profile.track ? profile.track.replace(/_/g, ' ') : undefined;
    const validatedLevel = profile.validated_level ?? undefined;
    const advancedPercentage = advancedResult.percentage ?? undefined;
    const skillPercentage = skillResult?.percentage ?? undefined;
    const tier = advancedResult.tier ?? undefined;

    const strongComp =
      poolProfile?.strong_competencies?.join(', ') ?? 'not specified';
    const topSkills = poolProfile?.competency_scores
      ? Object.entries(poolProfile.competency_scores)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([k]) => k.replace(/_/g, ' '))
          .join(', ')
      : 'not specified';

    const userPrompt = `
Generate a 3-4 sentence professional summary for an employer audience.

Candidate details:
- Name: ${fullName}
${role ? `- Role track: ${role}` : ''}
${validatedLevel ? `- Validated level: ${validatedLevel}` : ''}
${tier ? `- Assessment tier: ${tier}` : ''}
${advancedPercentage != null ? `- Advanced assessment score: ${advancedPercentage}%` : ''}
${skillPercentage != null ? `- Skill assessment score: ${skillPercentage}%` : ''}
- Strong competencies: ${strongComp}
- Top skills: ${topSkills}
${profile.bio ? `- Self description: ${profile.bio}` : ''}

Write a third-person summary (3-4 sentences) that an employer would find useful when reviewing this candidate's verified profile. Be specific about their validated abilities. Do not fabricate details.`.trim();

    try {
      const result = await this.openRouterService.chat(
        AI_SUMMARY_SYSTEM_PROMPT,
        userPrompt,
        AI_SUMMARY_SCHEMA,
        0.3,
      );
      return result.summary;
    } catch (error) {
      this.logger.warn(
        `AI summary generation failed for user=${user.id}: ${String(error)}`,
      );
      return undefined;
    }
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
