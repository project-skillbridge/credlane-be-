import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AssessmentAttempt,
  AssessmentResult,
  AssessmentType,
} from '../assessments/entities';
import { TalentProfile } from '../talent/entities/talent-profile.entity';

export type TalentGuidanceReportsResponse = {
  skill_guidance_report: Record<string, unknown> | null;
  advanced_guidance_report: Record<string, unknown> | null;
};

@Injectable()
export class AiReportService {
  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepo: Repository<TalentProfile>,
    @InjectRepository(AssessmentResult)
    private readonly assessmentResultRepo: Repository<AssessmentResult>,
  ) {}

  async getGuidanceReports(userId: string): Promise<TalentGuidanceReportsResponse> {
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
      skill_guidance_report: skillResult?.guidance_report ?? null,
      advanced_guidance_report: advancedResult?.guidance_report ?? null,
    };
  }

  private getLatestResult(
    talentProfileId: string,
    assessmentType: AssessmentType,
  ): Promise<AssessmentResult | null> {
    return this.assessmentResultRepo
      .createQueryBuilder('result')
      .innerJoin(AssessmentAttempt, 'attempt', 'attempt.id = result.attempt_id')
      .where('attempt.talent_profile_id = :talentProfileId', {
        talentProfileId,
      })
      .andWhere('attempt.assessment_type = :assessmentType', {
        assessmentType,
      })
      .orderBy('attempt.completed_at', 'DESC', 'NULLS LAST')
      .addOrderBy('result.created_at', 'DESC')
      .getOne();
  }
}
