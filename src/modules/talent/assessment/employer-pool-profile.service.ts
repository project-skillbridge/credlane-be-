import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { EmployerPoolProfile } from '../entities/employer-pool-profile.entity';
import { TalentProfile } from '../entities/talent-profile.entity';
import { AssessmentTier } from '../../assessments/entities/assessment-result.entity';
import { ScoredTextAnswer } from '../../ai/ai.types';
import { TalentPersonalAssessmentContext } from './personal-assessment.service';

export interface EmployerPoolProfileInput {
  profile: TalentProfile;
  userId: string;
  score: number;
  tier: AssessmentTier;
  percentage: number;
  scoredTextAnswers: ScoredTextAnswer[];
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
      score,
      tier,
      scoredTextAnswers,
      integrityClean,
      personalContext,
    } = input;

    const { strongCompetencies, competencyScores } =
      this.deriveCompetencies(scoredTextAnswers);

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
      score,
      tier,
      strong_competencies: strongCompetencies,
      competency_scores: competencyScores,
      industry_background: this.resolveIndustryBackground(personalContext),
      work_preferences: this.resolveWorkPreferences(personalContext),
      availability: this.resolveAvailability(personalContext),
      location: this.resolveLocation(profile, personalContext),
      integrity_clean: integrityClean,
      shareable_link_token: existing?.shareable_link_token ?? token,
    };

    if (existing) {
      await this.poolRepo.update({ id: existing.id }, patch);
      this.logger.log(`Employer pool profile updated: talent=${profile.id}`);
      return { ...existing, ...patch } as EmployerPoolProfile;
    }

    const created = this.poolRepo.create(patch);
    const saved = await this.poolRepo.save(created);
    this.logger.log(`Employer pool profile created: talent=${profile.id}`);
    return saved;
  }

  private deriveCompetencies(scored: ScoredTextAnswer[]): {
    strongCompetencies: string[];
    competencyScores: Record<string, number>;
  } {
    const competencyScores: Record<string, number> = {};
    const strongCompetencies: string[] = [];

    for (const answer of scored) {
      const pct =
        answer.max_score > 0
          ? Math.round((answer.raw_score / answer.max_score) * 100)
          : 0;
      competencyScores[answer.question_id] = pct;
      if (pct >= 70) {
        strongCompetencies.push(answer.question_id);
      }
    }

    return { strongCompetencies, competencyScores };
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
    const keys = ['industryExperience', 'yearsOfExperience', 'currentRole', 'previousRole'];
    const result: Record<string, unknown> = {};
    for (const k of keys) {
      if (ctx[k] !== undefined && ctx[k] !== null) result[k] = ctx[k];
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  private resolveWorkPreferences(
    ctx: TalentPersonalAssessmentContext,
  ): Record<string, unknown> | null {
    const keys = ['workStyle', 'preferredEnvironment', 'remotePreference', 'teamSize'];
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
