import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AssessmentAttempt,
  AssessmentQuestion,
  AssessmentResult,
  AssessmentScore,
  AssessmentType,
} from '../assessments/entities';
import { AssessmentTier } from '../assessments/entities/assessment-result.entity';
import { VerifiedLevel } from '../assessments/entities/assessment-question.entity';
import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { GuidanceReportService } from '../ai/guidance-report.service';
import { GuidanceReportInput } from '../ai/ai.types';

export type GuidanceReportEnvelope = {
  score: number;
  percentile: number;
  attempt_date: string | null;
  report_type: string;
  ai_summary: string;
  summary: string;
  retake_advice: string;
  growth_insight: string;
  strength_ratings: unknown[];
  resource_page_url: string;
  weak_area_ratings: unknown[];
  recommended_resources: unknown[];
} | null;

export type TalentGuidanceReportsResponse = {
  skill_guidance_report: GuidanceReportEnvelope;
  advanced_guidance_report: GuidanceReportEnvelope;
};

@Injectable()
export class AiReportService {
  private readonly logger = new Logger(AiReportService.name);

  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepo: Repository<TalentProfile>,
    @InjectRepository(AssessmentResult)
    private readonly assessmentResultRepo: Repository<AssessmentResult>,
    private readonly guidanceReportGenerator: GuidanceReportService,
  ) {}

  async getGuidanceReports(
    userId: string,
  ): Promise<TalentGuidanceReportsResponse> {
    const profile = await this.talentProfileRepo.findOne({
      where: { user_id: userId },
    });
    if (!profile) {
      return {
        skill_guidance_report: null,
        advanced_guidance_report: null,
      };
    }

    const [skillResult, advancedResult] = await Promise.all([
      this.getLatestResult(profile.id, AssessmentType.SKILL),
      this.getLatestResult(profile.id, AssessmentType.ADVANCED),
    ]);

    const [skillPercentile, advancedPercentile] = await Promise.all([
      skillResult
        ? this.calculatePercentile(
            AssessmentType.SKILL,
            skillResult.percentage ?? 0,
          )
        : 0,
      advancedResult
        ? this.calculatePercentile(
            AssessmentType.ADVANCED,
            advancedResult.percentage ?? 0,
          )
        : 0,
    ]);

    const [skill_guidance_report, advanced_guidance_report] = await Promise.all(
      [
        this.buildEnvelope(skillResult, skillPercentile, null, 'skill'),
        this.buildEnvelope(
          advancedResult,
          advancedPercentile,
          profile,
          'advanced',
        ),
      ],
    );

    return { skill_guidance_report, advanced_guidance_report };
  }

  private async buildEnvelope(
    result:
      | (AssessmentResult & { attempt_completed_at?: string | null })
      | null,
    percentile: number,
    profile?: TalentProfile | null,
    assessmentType?: 'skill' | 'advanced',
  ): Promise<GuidanceReportEnvelope> {
    if (!result) return null;

    // Generate guidance report on demand if missing (fallback if worker failed)
    if (!result.guidance_report && profile) {
      result = await this.generateAndPersist(
        result,
        profile,
        assessmentType ?? 'advanced',
      );
    }

    const report = result.guidance_report ?? {};
    const rawResources =
      (report.recommended_resources as Record<string, unknown>[]) ?? [];

    const resources = await this.resolveResourceCompetencies(rawResources);

    return {
      score: result.percentage ?? 0,
      percentile,
      attempt_date: result.attempt_completed_at ?? null,
      report_type: (report.report_type as string) ?? '',
      ai_summary: (report.ai_summary as string) ?? '',
      summary: (report.summary as string) ?? '',
      retake_advice: (report.retake_advice as string) ?? '',
      growth_insight: (report.growth_insight as string) ?? '',
      strength_ratings: (report.strength_ratings as unknown[]) ?? [],
      resource_page_url: (report.resource_page_url as string) ?? '/resources',
      weak_area_ratings: (report.weak_area_ratings as unknown[]) ?? [],
      recommended_resources: resources,
    };
  }

  private async generateAndPersist(
    result: AssessmentResult & { attempt_completed_at?: string | null },
    profile: TalentProfile,
    assessmentType: 'skill' | 'advanced',
  ): Promise<AssessmentResult & { attempt_completed_at?: string | null }> {
    const tier = result.tier;
    const reportType =
      tier === AssessmentTier.JOB_READY ? 'job_ready' : 'emerging';

    // Extract competencies from assessment_scores + assessment_questions
    const { strong, weak } = await this.extractCompetenciesForResult(
      result.attempt_id,
    );

    const input: GuidanceReportInput = {
      report_type: reportType,
      assessment_type: assessmentType,
      track: profile.track ?? 'general',
      claimed_level: profile.claimed_level ?? VerifiedLevel.JUNIOR,
      validated_level: profile.validated_level ?? VerifiedLevel.JUNIOR,
      percentage: result.percentage ?? 0,
      strong_competencies: strong,
      weak_competencies: weak,
    };

    try {
      this.logger.log(
        `Generating guidance report on demand for result=${result.id}`,
      );
      const generated = await this.guidanceReportGenerator.generate(input);
      const guidanceReport = generated as unknown as Record<string, unknown>;

      await this.assessmentResultRepo.update(result.id, {
        guidance_report: guidanceReport as never,
      });

      this.logger.log(`Guidance report persisted for result=${result.id}`);
      return { ...result, guidance_report: guidanceReport };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        `Failed to generate guidance report: ${message}`,
        stack,
      );
      return result;
    }
  }

  private async extractCompetenciesForResult(
    attemptId: string,
  ): Promise<{ strong: string[]; weak: string[] }> {
    const scores = await this.assessmentResultRepo.manager.find(
      AssessmentScore,
      { where: { attempt_id: attemptId } },
    );

    if (scores.length === 0) return { strong: [], weak: [] };

    // Collect question IDs to look up competency
    const questionIds = [...new Set(scores.map((s) => s.question_id))];
    const questions = await this.assessmentResultRepo.manager
      .createQueryBuilder(AssessmentQuestion, 'q')
      .where('q.id IN (:...ids)', { ids: questionIds })
      .getMany();

    const competencyByQuestion = new Map<string, string>();
    for (const q of questions) {
      if (q.competency) competencyByQuestion.set(q.id, q.competency);
    }

    const strong = new Set<string>();
    const weak = new Set<string>();

    for (const score of scores) {
      if (score.max_score <= 0) continue;
      const ratio = score.raw_score / score.max_score;
      const competency =
        score.competency ?? competencyByQuestion.get(score.question_id);
      if (!competency) continue;

      if (ratio >= 0.7) strong.add(competency);
      else if (ratio < 0.5) weak.add(competency);
    }

    return { strong: [...strong], weak: [...weak] };
  }

  /**
   * If resources have a `competencies` array of UUIDs (legacy format),
   * resolve them to human-readable competency names from the questions table.
   */
  private async resolveResourceCompetencies(
    resources: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    if (resources.length === 0) return [];

    // Collect all unique UUIDs from competencies arrays
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const allIds = new Set<string>();

    for (const resource of resources) {
      const comps = resource.competencies;
      if (Array.isArray(comps)) {
        for (const id of comps) {
          if (typeof id === 'string' && uuidPattern.test(id)) {
            allIds.add(id);
          }
        }
      }
    }

    if (allIds.size === 0) return resources;

    // Batch-resolve UUIDs to competency names
    const ids = [...allIds];
    const questions = await this.assessmentResultRepo.manager
      .createQueryBuilder(AssessmentQuestion, 'q')
      .select(['q.id', 'q.competency'])
      .where('q.id IN (:...ids)', { ids })
      .getMany();

    const idToName = new Map<string, string>();
    for (const q of questions) {
      if (q.competency) {
        idToName.set(q.id, q.competency);
      }
    }

    // Replace UUID arrays with resolved name arrays
    return resources.map((resource) => {
      const comps = resource.competencies;
      if (!Array.isArray(comps)) return resource;

      const names = comps
        .map((id) => (typeof id === 'string' ? idToName.get(id) : undefined))
        .filter((name): name is string => !!name);

      return { ...resource, competencies: names };
    });
  }

  /**
   * Calculates the percentile rank: percentage of candidates who scored
   * strictly lower than the given score for this assessment type.
   */
  private async calculatePercentile(
    assessmentType: AssessmentType,
    userPercentage: number,
  ): Promise<number> {
    const raw: { total: number; below: number } | undefined =
      await this.assessmentResultRepo
        .createQueryBuilder('result')
        .innerJoin(
          AssessmentAttempt,
          'attempt',
          'attempt.id = result.attempt_id',
        )
        .where('attempt.assessment_type = :assessmentType', { assessmentType })
        .andWhere('result.percentage IS NOT NULL')
        .select('COUNT(*)::int', 'total')
        .addSelect(
          'COUNT(*) FILTER (WHERE result.percentage < :userPercentage)::int',
          'below',
        )
        .setParameter('userPercentage', userPercentage)
        .getRawOne();

    if (!raw || raw.total === 0) return 0;
    return Math.round((raw.below / raw.total) * 100);
  }

  private async getLatestResult(
    talentProfileId: string,
    assessmentType: AssessmentType,
  ): Promise<
    (AssessmentResult & { attempt_completed_at?: string | null }) | null
  > {
    const result = await this.assessmentResultRepo
      .createQueryBuilder('result')
      .innerJoinAndSelect(
        AssessmentAttempt,
        'attempt',
        'attempt.id = result.attempt_id',
      )
      .addSelect('attempt.completed_at', 'attempt_completed_at')
      .where('attempt.talent_profile_id = :talentProfileId', {
        talentProfileId,
      })
      .andWhere('attempt.assessment_type = :assessmentType', {
        assessmentType,
      })
      .orderBy('attempt.completed_at', 'DESC', 'NULLS LAST')
      .addOrderBy('result.created_at', 'DESC')
      .getRawAndEntities();

    const entity = result.entities[0];
    if (!entity) return null;

    const raw = result.raw[0] as
      | { attempt_completed_at?: string | null }
      | undefined;
    const completedAt = raw?.attempt_completed_at;

    return {
      ...entity,
      attempt_completed_at: completedAt
        ? new Date(completedAt).toISOString()
        : null,
    };
  }
}
