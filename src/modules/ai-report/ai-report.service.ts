import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AssessmentAttempt,
  AssessmentResult,
  AssessmentType,
} from '../assessments/entities';
import { TalentProfile } from '../talent/entities/talent-profile.entity';

export type GuidanceReportEnvelope = {
  score: number;
  max_score: number;
  percentage: number;
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
  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepo: Repository<TalentProfile>,
    @InjectRepository(AssessmentResult)
    private readonly assessmentResultRepo: Repository<AssessmentResult>,
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

    return {
      skill_guidance_report: this.buildEnvelope(skillResult),
      advanced_guidance_report: this.buildEnvelope(advancedResult),
    };
  }

  private buildEnvelope(
    result:
      | (AssessmentResult & { attempt_completed_at?: string | null })
      | null,
  ): GuidanceReportEnvelope {
    if (!result) return null;

    const report = result.guidance_report ?? {};

    return {
      score: result.score ?? 0,
      max_score: result.max_score ?? 100,
      percentage: result.percentage ?? 0,
      attempt_date: result.attempt_completed_at ?? null,
      report_type: (report.report_type as string) ?? '',
      ai_summary: (report.ai_summary as string) ?? '',
      summary: (report.summary as string) ?? '',
      retake_advice: (report.retake_advice as string) ?? '',
      growth_insight: (report.growth_insight as string) ?? '',
      strength_ratings: (report.strength_ratings as unknown[]) ?? [],
      resource_page_url: (report.resource_page_url as string) ?? '/resources',
      weak_area_ratings: (report.weak_area_ratings as unknown[]) ?? [],
      recommended_resources: (report.recommended_resources as unknown[]) ?? [],
    };
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
      .where('attempt.talent_profile_id = :talentProfileId', {
        talentProfileId,
      })
      .andWhere('attempt.assessment_type = :assessmentType', {
        assessmentType,
      })
      .orderBy('attempt.completed_at', 'DESC', 'NULLS LAST')
      .addOrderBy('result.created_at', 'DESC')
      .getOne();

    if (!result) return null;

    // Fetch the attempt's completed_at separately since the join doesn't hydrate onto the result entity
    const attempt = await this.assessmentResultRepo.manager.findOne(
      AssessmentAttempt,
      { where: { id: result.attempt_id }, select: ['completed_at'] },
    );

    return {
      ...result,
      attempt_completed_at: attempt?.completed_at?.toISOString() ?? null,
    };
  }
}
