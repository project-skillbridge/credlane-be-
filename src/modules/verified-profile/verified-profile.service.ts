import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
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
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentResult,
  AssessmentScore,
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
import type {
  VerifiedProfileAssessmentBreakdownItemDto,
  VerifiedProfileResponseDto,
  VerifiedProfileSkillBreakdownItemDto,
  VerifiedProfileSkillBreakdownTabDto,
} from './dto/verified-profile.dto';
import {
  buildQrCodeUrl,
  buildShareUrl,
  categorizeCompetencies,
  compactStrings,
  formatSlugLabel,
  readPersonalAnswers,
  readSessionQuestions,
  resolveAvailabilityLabel,
  resolveExperienceLabel,
  resolveGoalLabel,
  resolveJobSearchStatusLabel,
  resolveKeyStrengths,
  resolveRoleLabel,
  resolveSeniorityBadge,
  resolveSkills,
  resolveTierLabel,
  resolveWorkArrangementLabels,
  rubricScorePercentage,
} from './verified-profile.utils';

type BlockAggregate = { total: number; count: number };
type CompetencyBreakdown = {
  competencyScores: Record<string, number> | undefined;
  strongCompetencies: string[] | undefined;
};
type RatedProfileItem = { label: string; rating: number };
type GuidanceResourceItem = {
  title: string;
  provider: string;
  url: string;
  tier: 'free' | 'paid';
  competency: string;
  reason: string;
};
type GuidanceReportContent = {
  ai_report?: string;
  growth_insight?: string;
  summary?: string;
  strength_ratings?: RatedProfileItem[];
  weaknesses?: RatedProfileItem[];
  recommended_resources?: GuidanceResourceItem[];
  resource_page_url?: '/resources';
};
type AssessmentInsights = {
  skill_proficiency?: { label: string; insight: string };
  workplace_readiness?: { label: string; insight: string };
  practical_application?: { label: string; insight: string };
};

const SHARE_LINK_TOKEN_PATTERN = /^[a-fA-F0-9]{64}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    @InjectRepository(AssessmentScore)
    private readonly assessmentScoreRepository: Repository<AssessmentScore>,
    @InjectRepository(AssessmentQuestion)
    private readonly assessmentQuestionRepository: Repository<AssessmentQuestion>,
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

  async getForEmployerView(
    candidateUserId: string,
  ): Promise<VerifiedProfileResponse> {
    const poolProfile = await this.employerPoolRepository.findOne({
      where: { candidate_id: candidateUserId },
      relations: ['talent_profile'],
    });

    if (!poolProfile?.talent_profile || poolProfile.tier !== 'job_ready') {
      throw new NotFoundError(ErrorMessages.VERIFIED_PROFILE.NOT_AVAILABLE);
    }

    const user = await this.usersService.findOne(candidateUserId);
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
    const guidanceReport = this.readGuidanceReport(
      latestAdvancedResult?.guidance_report,
    );

    const hasValidatedLevel =
      profile.validated_level != null || poolProfile?.verified_level != null;
    const validatedLevel =
      profile.validated_level ??
      (poolProfile?.verified_level as VerifiedLevel | undefined) ??
      VerifiedLevel.JUNIOR;

    const skillProficiency =
      validatedLevel != null
        ? {
            validated_level: validatedLevel,
            ...(latestSkillResult?.percentage != null && {
              skill_assessment_percentage: latestSkillResult.percentage,
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
    const scorePercentage =
      latestAdvancedResult?.percentage ?? poolProfile?.score ?? undefined;

    const { competencyScores, strongCompetencies } =
      await this.resolveCompetencyBreakdown(
        latestAdvancedResult?.attempt_id,
        poolProfile,
      );

    const keyStrengths = resolveKeyStrengths(
      competencyScores,
      strongCompetencies,
    );
    const { professionalSkills } = categorizeCompetencies(competencyScores);
    const aboutTags = this.buildAboutTags(
      personalAnswers,
      seniorityBadge,
      hasValidatedLevel,
      tierLabel,
      poolProfile,
      profile.availability_status,
    );

    const shareUrl = buildShareUrl(
      env.FRONTEND_URL,
      poolProfile?.shareable_link_token ?? profile.profile_share_link,
    );
    const qrCodeUrl = buildQrCodeUrl(shareUrl);

    let aiReport = guidanceReport.ai_report;
    if (!aiReport && latestAdvancedResult) {
      aiReport = await this.generateAiSummary(
        user,
        profile,
        latestAdvancedResult,
        latestSkillResult,
        poolProfile,
      );
    }
    const workingStyle = this.resolveWorkingStyle(poolProfile, personalAnswers);
    const assessmentInsights = this.buildAssessmentInsights(
      skillProficiency,
      blockScores,
      guidanceReport,
    );
    const growthInsight = guidanceReport.growth_insight ?? '';
    const skillBreakdownTabs = this.buildSkillBreakdownTabs({
      scorePercentage,
      skillProficiency,
      blockScores,
      assessmentInsights,
      professionalSkills,
      keyStrengths,
      growthInsight,
      aiReport: aiReport ?? '',
      workingStyle,
      weaknesses: guidanceReport.weaknesses,
    });
    const tier =
      latestAdvancedResult?.tier ?? poolProfile?.tier ?? profile.status;

    return {
      full_name: `${user.first_name} ${user.last_name}`.trim(),
      role: resolveRoleLabel(
        profile.track,
        profile.role_track,
        poolProfile?.specialization ?? null,
        personalAnswers,
      ),
      goal: resolveGoalLabel(profile.goal),
      about: profile.bio?.trim() ?? '',
      about_tags: aboutTags,
      ai_report: aiReport ?? '',
      avatar_url: user.avatar_url ?? null,
      verified: true,
      status: tier,
      seniority_badge: seniorityBadge ?? '',
      tier,
      tier_label: tierLabel ?? '',
      score_percentage: scorePercentage ?? 0,
      skills: skills ?? [],
      working_style: workingStyle,
      growth_insight: growthInsight,
      skill_breakdown_tabs: skillBreakdownTabs,
      recommended_resources: guidanceReport.recommended_resources ?? [],
      resource_page_url: '/resources',
      email: user.email,
      resume_url: profile.resume_url ?? null,
      share_url: shareUrl,
      qr_code_url: qrCodeUrl ?? null,
      is_owner: isOwner ?? false,
      verified_at: verifiedAt.toISOString(),
    };
  }

  private buildSkillBreakdownTabs(input: {
    scorePercentage: number | undefined;
    skillProficiency:
      | {
          validated_level: VerifiedLevel;
          skill_assessment_percentage?: number;
        }
      | undefined;
    blockScores: {
      workplaceReadiness?: { percentage: number; label: string };
      practicalApplication?: { percentage: number; label: string };
    };
    assessmentInsights: AssessmentInsights;
    professionalSkills:
      | Array<{ label: string; percentage: number }>
      | undefined;
    keyStrengths:
      | Array<{ competency: string; label: string; percentage: number }>
      | undefined;
    growthInsight: string;
    aiReport: string;
    workingStyle: string[];
    weaknesses?: RatedProfileItem[];
  }): VerifiedProfileSkillBreakdownTabDto[] {
    const defaultInsight =
      input.growthInsight.trim() ||
      input.aiReport.trim() ||
      'Assessment insights are not available yet.';
    const skillPercentage =
      input.scorePercentage ??
      input.skillProficiency?.skill_assessment_percentage ??
      0;
    const skillInsight =
      input.assessmentInsights.skill_proficiency?.insight ??
      (input.skillProficiency?.skill_assessment_percentage != null
        ? `Validated at ${formatSlugLabel(
            input.skillProficiency.validated_level,
          )} with a ${input.skillProficiency.skill_assessment_percentage}% skill assessment score.`
        : defaultInsight);
    const workplacePercentage =
      input.blockScores.workplaceReadiness?.percentage ?? 0;
    const practicalPercentage =
      input.blockScores.practicalApplication?.percentage ?? 0;

    const assessmentItems: VerifiedProfileAssessmentBreakdownItemDto[] = [
      {
        id: 'skill_proficiency',
        label: 'Skill Proficiency',
        percentage: skillPercentage,
        validated_level: input.skillProficiency?.validated_level ?? 'mid',
        insight: skillInsight,
      },
      {
        id: 'workplace_readiness',
        label: 'Workplace Readiness',
        percentage: workplacePercentage,
        insight:
          input.assessmentInsights.workplace_readiness?.insight ??
          defaultInsight,
      },
      {
        id: 'practical_application',
        label: 'Practical Application',
        percentage: practicalPercentage,
        insight:
          input.assessmentInsights.practical_application?.insight ??
          defaultInsight,
      },
    ];

    const rowInsight = input.growthInsight.trim()
      ? input.growthInsight
      : undefined;
    let professionalItems: VerifiedProfileSkillBreakdownItemDto[] = (
      input.professionalSkills ?? []
    ).map(({ label, percentage }) => ({
      label,
      percentage,
      ...(rowInsight && { insight: rowInsight }),
    }));

    let strengthItems: VerifiedProfileSkillBreakdownItemDto[] = (
      input.keyStrengths ?? []
    ).map(({ competency, label, percentage }) => ({
      competency,
      label,
      percentage,
      ...(rowInsight && { insight: rowInsight }),
    }));

    if (professionalItems.length === 0 && skillPercentage > 0) {
      professionalItems = [
        {
          label: 'General',
          percentage: skillPercentage,
          ...(rowInsight && { insight: rowInsight }),
        },
      ];
    }

    if (strengthItems.length === 0 && skillPercentage > 0) {
      strengthItems = [
        {
          competency: 'general',
          label: 'General',
          percentage: skillPercentage,
          ...(rowInsight && { insight: rowInsight }),
        },
      ];
    }

    return [
      {
        id: 'assessment_scores',
        label: 'Assessment Scores',
        items: assessmentItems,
      },
      {
        id: 'professional_skills',
        label: 'Professional Skills',
        items: professionalItems,
      },
      {
        id: 'key_strengths',
        label: 'Strengths',
        items: strengthItems,
      },
      ...(input.workingStyle.length > 0
        ? [
            {
              id: 'working_style',
              label: 'Working Style',
              items: input.workingStyle.map((label) => ({
                label,
                percentage: 100,
                ...(rowInsight && { insight: rowInsight }),
              })),
            },
          ]
        : []),
      ...((input.weaknesses?.length ?? 0) > 0
        ? [
            {
              id: 'weaknesses',
              label: 'Weaknesses',
              items: (input.weaknesses ?? []).map(({ label, rating }) => ({
                label,
                percentage: this.ratingToPercentage(rating),
                ...(rowInsight && { insight: rowInsight }),
              })),
            },
          ]
        : []),
    ];
  }

  /**
   * Converts a guidance report rating to a 0–100 display percentage.
   * Defensive dual-scale handling: values ≤ 5 are treated as a 1–5 star
   * rating and scaled to 0–100; larger values are already percentages and
   * are clamped to [0, 100]. Both paths go through Math.min/Math.max so
   * out-of-range inputs never produce negative or over-100 results.
   */
  private ratingToPercentage(rating: number): number {
    if (rating <= 5) {
      return Math.min(100, Math.max(0, Math.round((rating / 5) * 100)));
    }
    return Math.min(100, Math.max(0, Math.round(rating)));
  }

  private readGuidanceReport(
    report: Record<string, unknown> | null | undefined,
  ): GuidanceReportContent {
    if (!report || typeof report !== 'object' || Array.isArray(report)) {
      return {};
    }

    return {
      ...this.readGuidanceString(report, 'ai_summary', 'ai_report'),
      ...this.readGuidanceString(report, 'growth_insight', 'growth_insight'),
      ...this.readGuidanceString(report, 'summary', 'summary'),
      ...this.readRatedItems(report, 'strength_ratings', 'strength_ratings'),
      ...this.readRatedItems(report, 'weak_area_ratings', 'weaknesses'),
      ...this.readGuidanceResources(report),
      ...(report.resource_page_url === '/resources' && {
        resource_page_url: '/resources' as const,
      }),
    };
  }

  private readGuidanceString(
    report: Record<string, unknown>,
    sourceKey: string,
    targetKey: keyof GuidanceReportContent,
  ): Partial<GuidanceReportContent> {
    const value = report[sourceKey];
    return typeof value === 'string' && value.trim()
      ? { [targetKey]: value.trim() }
      : {};
  }

  private readRatedItems(
    report: Record<string, unknown>,
    sourceKey: string,
    targetKey: 'strength_ratings' | 'weaknesses',
  ): Partial<GuidanceReportContent> {
    const rawItems = report[sourceKey];
    if (!Array.isArray(rawItems)) {
      return {};
    }

    const items = rawItems
      .map((item): RatedProfileItem | null => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null;
        }
        const record = item as Record<string, unknown>;
        const label = record.item;
        const rating = record.rating;
        return typeof label === 'string' &&
          label.trim() &&
          typeof rating === 'number' &&
          Number.isFinite(rating)
          ? { label: label.trim(), rating }
          : null;
      })
      .filter((item): item is RatedProfileItem => Boolean(item));

    return items.length > 0 ? { [targetKey]: items } : {};
  }

  private readGuidanceResources(
    report: Record<string, unknown>,
  ): Partial<GuidanceReportContent> {
    const rawResources = report.recommended_resources;
    if (!Array.isArray(rawResources)) {
      return {};
    }

    const resources = rawResources
      .map((resource): GuidanceResourceItem | null => {
        if (
          !resource ||
          typeof resource !== 'object' ||
          Array.isArray(resource)
        ) {
          return null;
        }

        const record = resource as Record<string, unknown>;
        if (
          typeof record.title !== 'string' ||
          typeof record.provider !== 'string' ||
          typeof record.url !== 'string' ||
          typeof record.competency !== 'string' ||
          typeof record.reason !== 'string' ||
          (record.tier !== 'free' && record.tier !== 'paid')
        ) {
          return null;
        }

        return {
          title: record.title,
          provider: record.provider,
          url: record.url,
          tier: record.tier,
          competency: record.competency,
          reason: record.reason,
        };
      })
      .filter((resource): resource is GuidanceResourceItem =>
        Boolean(resource),
      );

    return resources.length > 0 ? { recommended_resources: resources } : {};
  }

  private resolveWorkingStyle(
    poolProfile: EmployerPoolProfile | null | undefined,
    personalAnswers: Record<string, unknown>,
  ): string[] {
    const source = {
      ...(poolProfile?.work_preferences ?? {}),
      work_arrangement_preference: personalAnswers.work_arrangement_preference,
      remote_experience: personalAnswers.remote_experience,
      remote_workspace_setup: personalAnswers.remote_workspace_setup,
    };

    const values: Array<string | null | undefined> = [];
    for (const value of Object.values(source)) {
      if (Array.isArray(value)) {
        values.push(
          ...value.filter(
            (item): item is string | null | undefined =>
              typeof item === 'string' || item == null,
          ),
        );
        continue;
      }

      if (typeof value === 'string' || value == null) {
        values.push(value);
      }
    }

    return compactStrings(values).map(formatSlugLabel);
  }

  private buildAssessmentInsights(
    skillProficiency:
      | { validated_level: VerifiedLevel; skill_assessment_percentage?: number }
      | undefined,
    blockScores: {
      workplaceReadiness?: { percentage: number; label: string };
      practicalApplication?: { percentage: number; label: string };
    },
    guidanceReport: GuidanceReportContent,
  ): AssessmentInsights {
    return {
      ...(skillProficiency?.skill_assessment_percentage != null && {
        skill_proficiency: {
          label: 'Skill Proficiency',
          insight:
            guidanceReport.summary ??
            `Validated at ${formatSlugLabel(
              skillProficiency.validated_level,
            )} with a ${skillProficiency.skill_assessment_percentage}% skill assessment score.`,
        },
      }),
      ...(blockScores.workplaceReadiness && {
        workplace_readiness: {
          label: blockScores.workplaceReadiness.label,
          insight:
            guidanceReport.growth_insight ??
            `Workplace readiness is currently ${blockScores.workplaceReadiness.percentage}%.`,
        },
      }),
      ...(blockScores.practicalApplication && {
        practical_application: {
          label: blockScores.practicalApplication.label,
          insight:
            guidanceReport.growth_insight ??
            `Practical application is currently ${blockScores.practicalApplication.percentage}%.`,
        },
      }),
    };
  }

  private async resolveCompetencyBreakdown(
    attemptId: string | undefined,
    poolProfile?: EmployerPoolProfile | null,
  ): Promise<CompetencyBreakdown> {
    const scoreRows = attemptId
      ? await this.assessmentScoreRepository.find({
          where: { attempt_id: attemptId },
        })
      : [];
    const scoreBreakdown =
      this.buildCompetencyBreakdownFromScoreRows(scoreRows);
    if (scoreBreakdown.competencyScores) {
      return scoreBreakdown;
    }

    const competencyScores = poolProfile?.competency_scores ?? undefined;
    const strongCompetencies = poolProfile?.strong_competencies ?? undefined;
    if (!competencyScores) {
      return { competencyScores: undefined, strongCompetencies: undefined };
    }

    const questionIds = [
      ...Object.keys(competencyScores),
      ...(strongCompetencies ?? []),
    ].filter((value) => UUID_PATTERN.test(value));

    if (questionIds.length === 0) {
      return { competencyScores, strongCompetencies };
    }

    const questionCompetencies =
      await this.resolveQuestionCompetencyMap(questionIds);
    return this.remapPoolCompetencyBreakdown(
      competencyScores,
      strongCompetencies,
      questionCompetencies,
    );
  }

  private buildCompetencyBreakdownFromScoreRows(
    scoreRows: AssessmentScore[],
  ): CompetencyBreakdown {
    const buckets = new Map<string, BlockAggregate>();

    for (const row of scoreRows) {
      const competency = row.competency?.trim().toLowerCase();
      if (!competency || UUID_PATTERN.test(competency)) {
        continue;
      }

      const bucket = buckets.get(competency) ?? { total: 0, count: 0 };
      bucket.total += row.pct_score;
      bucket.count += 1;
      buckets.set(competency, bucket);
    }

    return this.toCompetencyBreakdown(buckets);
  }

  private async resolveQuestionCompetencyMap(
    questionIds: string[],
  ): Promise<Map<string, string>> {
    const uniqueQuestionIds = [...new Set(questionIds)];
    const questions = await this.assessmentQuestionRepository.find({
      where: { id: In(uniqueQuestionIds) },
    });

    return new Map(
      questions
        .map((question): [string, string] | null => {
          const metadata = (question.metadata ?? {}) as Record<string, unknown>;
          const metadataCompetency =
            typeof metadata.competency === 'string'
              ? metadata.competency
              : null;
          const competency = (question.competency ?? metadataCompetency ?? '')
            .trim()
            .toLowerCase();

          return competency && !UUID_PATTERN.test(competency)
            ? [question.id, competency]
            : null;
        })
        .filter((entry): entry is [string, string] => Boolean(entry)),
    );
  }

  private remapPoolCompetencyBreakdown(
    competencyScores: Record<string, number>,
    strongCompetencies: string[] | undefined,
    questionCompetencies: Map<string, string>,
  ): CompetencyBreakdown {
    const buckets = new Map<string, BlockAggregate>();

    for (const [rawCompetency, percentage] of Object.entries(
      competencyScores,
    )) {
      const competency = this.resolveDisplayCompetency(
        rawCompetency,
        questionCompetencies,
      );
      if (!competency) {
        continue;
      }

      const bucket = buckets.get(competency) ?? { total: 0, count: 0 };
      bucket.total += percentage;
      bucket.count += 1;
      buckets.set(competency, bucket);
    }

    const breakdown = this.toCompetencyBreakdown(buckets);
    if (breakdown.competencyScores) {
      return breakdown;
    }

    return {
      competencyScores: undefined,
      strongCompetencies: strongCompetencies
        ?.map((competency) =>
          this.resolveDisplayCompetency(competency, questionCompetencies),
        )
        .filter((competency): competency is string => Boolean(competency)),
    };
  }

  private resolveDisplayCompetency(
    competency: string,
    questionCompetencies: Map<string, string>,
  ): string | null {
    const trimmed = competency.trim();
    if (!UUID_PATTERN.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    return questionCompetencies.get(trimmed) ?? null;
  }

  private toCompetencyBreakdown(
    buckets: Map<string, BlockAggregate>,
  ): CompetencyBreakdown {
    if (buckets.size === 0) {
      return { competencyScores: undefined, strongCompetencies: undefined };
    }

    const competencyScores: Record<string, number> = {};
    const strongCompetencies: string[] = [];

    for (const [competency, { total, count }] of buckets.entries()) {
      const percentage = Math.round(total / Math.max(count, 1));
      competencyScores[competency] = percentage;
      if (percentage >= 70) {
        strongCompetencies.push(competency);
      }
    }

    return { competencyScores, strongCompetencies };
  }

  /**
   * Invariant: seniorityBadge and the experience label are mutually exclusive.
   * When a validated level exists it is authoritative; the self-reported
   * years_experience is redundant and contradictory alongside it.
   */
  private buildAboutTags(
    personalAnswers: Record<string, unknown>,
    seniorityBadge: string | undefined,
    hasValidatedLevel: boolean,
    tierLabel: string | undefined,
    poolProfile?: EmployerPoolProfile | null,
    profileAvailabilityStatus?: string | null,
  ): string[] {
    const jobSearchStatus =
      profileAvailabilityStatus ?? personalAnswers.job_search_status;

    return compactStrings([
      seniorityBadge,
      tierLabel,
      resolveJobSearchStatusLabel(jobSearchStatus),
      ...resolveWorkArrangementLabels(
        personalAnswers.work_arrangement_preference,
      ),
      hasValidatedLevel
        ? undefined
        : resolveExperienceLabel(personalAnswers.years_experience),
      jobSearchStatus !== 'not_looking'
        ? resolveAvailabilityLabel(
            poolProfile?.availability ?? personalAnswers.availability,
          )
        : undefined,
    ]);
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
