import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { EmployerPoolProfile } from '../entities/employer-pool-profile.entity';
import { TalentProfile } from '../entities/talent-profile.entity';
import { AssessmentTier } from '../../assessments/entities/assessment-result.entity';
import { ScoredTextAnswer } from '../../ai/ai.types';
import { TalentPersonalAssessmentContext } from './personal-assessment.service';
import { sanitiseCompetencyList } from './competency-taxonomy';

export interface EmployerPoolProfileInput {
  profile: TalentProfile;
  userId: string;
  tier: AssessmentTier;
  /** Assessment percentage (0–100); stored as pool.score for employer discovery. */
  percentage: number;
  scoredTextAnswers: ScoredTextAnswer[];
  /**
   * Optional map from question_id -> competency tag (track taxonomy),
   * looked up from the session jsonb at submit time. When present, the
   * employer-facing competency_scores are aggregated by competency instead
   * of by question_id.
   */
  competencyByQuestion?: Map<string, string | null>;
  integrityClean: boolean;
  personalContext: TalentPersonalAssessmentContext;
}

@Injectable()
export class EmployerPoolProfileService {
  private readonly logger = new Logger(EmployerPoolProfileService.name);

  constructor(
    @InjectRepository(EmployerPoolProfile)
    private readonly poolRepo: Repository<EmployerPoolProfile>,
  ) {}

  async upsert(input: EmployerPoolProfileInput): Promise<EmployerPoolProfile> {
    const {
      profile,
      userId,
      percentage,
      tier,
      scoredTextAnswers,
      integrityClean,
      personalContext,
    } = input;

    const { strongCompetencies, competencyScores } = this.deriveCompetencies(
      scoredTextAnswers,
      profile.track ?? null,
      input.competencyByQuestion,
    );

    const token = randomBytes(32).toString('hex');

    const existing = await this.poolRepo.findOne({
      where: { talent_profile_id: profile.id },
    });

    const patch: Partial<EmployerPoolProfile> = {
      talent_profile_id: profile.id,
      candidate_id: userId,
      verified_at: new Date(),
      track: profile.track ?? null,
      specialization: this.resolveSpecialization(personalContext),
      verified_level: profile.validated_level ?? '',
      score: Math.round(percentage),
      tier,
      strong_competencies: strongCompetencies,
      competency_scores: competencyScores,
      industry_background: this.resolveIndustryBackground(personalContext),
      work_preferences: this.resolveWorkPreferences(personalContext),
      availability: this.resolveAvailability(personalContext),
      job_search_status: this.resolveJobSearchStatus(personalContext),
      location: this.resolveLocation(profile, personalContext),
      integrity_clean: integrityClean,
      shareable_link_token: existing?.shareable_link_token ?? token,
    };

    if (existing) {
      const merged = this.poolRepo.merge(existing, patch);
      const updated = await this.poolRepo.save(merged);
      this.logger.log(`Employer pool profile updated: talent=${profile.id}`);
      return updated;
    }

    const created = this.poolRepo.create(patch);
    const saved = await this.poolRepo.save(created);
    this.logger.log(`Employer pool profile created: talent=${profile.id}`);
    return saved;
  }

  private deriveCompetencies(
    scored: ScoredTextAnswer[],
    track: string | null,
    competencyByQuestion: Map<string, string | null> | undefined,
  ): {
    strongCompetencies: string[];
    competencyScores: Record<string, number>;
  } {
    // Aggregate by competency tag, not by question_id. When no competency
    // lookup is provided (or a question has no tag), fall back to the
    // question_id so we never silently drop a data point.
    const buckets = new Map<string, { sum: number; count: number }>();

    for (const answer of scored) {
      const pct =
        answer.max_score > 0 ? (answer.raw_score / answer.max_score) * 100 : 0;
      const competency =
        competencyByQuestion?.get(answer.question_id) ?? answer.question_id;
      const key = competency.toLowerCase();
      const existing = buckets.get(key) ?? { sum: 0, count: 0 };
      existing.sum += pct;
      existing.count += 1;
      buckets.set(key, existing);
    }

    const competencyScores: Record<string, number> = {};
    const strongRaw: string[] = [];
    for (const [competency, { sum, count }] of buckets.entries()) {
      const avg = Math.round(sum / Math.max(count, 1));
      competencyScores[competency] = avg;
      if (avg >= 70) strongRaw.push(competency);
    }

    return {
      strongCompetencies: sanitiseCompetencyList(track, strongRaw),
      competencyScores,
    };
  }

  private resolveSpecialization(
    ctx: TalentPersonalAssessmentContext,
  ): string | null {
    const spec = ctx['specialization'] ?? ctx['primarySpecialization'] ?? null;
    return typeof spec === 'string' ? spec : null;
  }

  private resolveIndustryBackground(
    ctx: TalentPersonalAssessmentContext,
  ): Record<string, unknown> | null {
    const keys = [
      'industryExperience',
      'yearsOfExperience',
      'currentRole',
      'previousRole',
    ];
    const result: Record<string, unknown> = {};
    for (const k of keys) {
      if (ctx[k] !== undefined && ctx[k] !== null) result[k] = ctx[k];
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  private resolveWorkPreferences(
    ctx: TalentPersonalAssessmentContext,
  ): Record<string, unknown> | null {
    const keys = [
      'workStyle',
      'preferredEnvironment',
      'remotePreference',
      'teamSize',
    ];
    const result: Record<string, unknown> = {};
    for (const k of keys) {
      if (ctx[k] !== undefined && ctx[k] !== null) result[k] = ctx[k];
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  private resolveAvailability(
    ctx: TalentPersonalAssessmentContext,
  ): string | null {
    const val = ctx['availability'] ?? ctx['availableFrom'] ?? null;
    return typeof val === 'string' ? val : null;
  }

  private resolveJobSearchStatus(
    ctx: TalentPersonalAssessmentContext,
  ): string | null {
    const val = ctx['job_search_status'] ?? null;
    if (typeof val !== 'string') return null;

    // Map personal assessment values to TalentAvailabilityStatus equivalents
    const mapping: Record<string, string> = {
      actively_looking: 'actively_looking',
      open_to_right_opportunity: 'open_to_opportunities',
      just_exploring: 'not_looking',
    };
    return mapping[val] ?? val;
  }

  private resolveLocation(
    profile: TalentProfile,
    ctx: TalentPersonalAssessmentContext,
  ): string | null {
    const region = profile.region ?? ctx['region'] ?? null;
    const country = ctx['country'];
    if (region && country) return `${region}, ${country}`;
    if (region) return typeof region === 'string' ? region : null;
    if (country) return typeof country === 'string' ? country : null;
    return null;
  }
}
