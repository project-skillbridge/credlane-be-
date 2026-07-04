import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../../talent/entities/talent-profile.entity';
import { AssessmentAttempt } from '../../assessments/entities/assessment-attempt.entity';
import { AssessmentResult } from '../../assessments/entities/assessment-result.entity';
import { AssessmentScore } from '../../assessments/entities/assessment-score.entity';
import { AssessmentType } from '../../assessments/entities/assessment-question.entity';
import { SKILL_ASSESSMENT_MAX_ATTEMPTS } from '../../talent/talent.constants';
import { ListTalentsQueryDto } from './dto/list-talents-query.dto';

const TIER_DISPLAY_LABELS: Record<TalentProfileStatus, string> = {
  [TalentProfileStatus.NOT_READY]: 'Rejected',
  [TalentProfileStatus.EMERGING]: 'Emerging',
  [TalentProfileStatus.JOB_READY]: 'Job Ready',
  [TalentProfileStatus.NOT_STARTED]: 'Onboarding',
  [TalentProfileStatus.IN_PROGRESS]: 'Onboarding',
};

export interface TalentListRow {
  id: string;
  name: string;
  email: string;
  track: string | null;
  tier: string;
  latest_stage3_score: number | null;
  onboarding_date: Date;
  last_activity_date: Date;
}

@Injectable()
export class AdminTalentsService {
  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepo: Repository<TalentProfile>,
    @InjectRepository(AssessmentAttempt)
    private readonly assessmentAttemptRepo: Repository<AssessmentAttempt>,
    @InjectRepository(AssessmentResult)
    private readonly assessmentResultRepo: Repository<AssessmentResult>,
    @InjectRepository(AssessmentScore)
    private readonly assessmentScoreRepo: Repository<AssessmentScore>,
  ) {}

  async findAll(query: ListTalentsQueryDto): Promise<{
    items: TalentListRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.talentProfileRepo
      .createQueryBuilder('tp')
      .innerJoin('tp.user', 'profile_user');

    const latestScoreSubQuery = qb
      .subQuery()
      .select('result.percentage')
      .from(AssessmentResult, 'result')
      .innerJoin(AssessmentAttempt, 'attempt', 'attempt.id = result.attempt_id')
      .where('attempt.talent_profile_id = tp.id')
      .andWhere('attempt.assessment_type = :advancedType')
      .andWhere('result.percentage IS NOT NULL')
      .orderBy('result.created_at', 'DESC')
      .limit(1)
      .getQuery();

    qb.addSelect(`(${latestScoreSubQuery})`, 'latest_score').setParameter(
      'advancedType',
      AssessmentType.ADVANCED,
    );

    if (query.track) {
      qb.andWhere('tp.track = :track', { track: query.track });
    }
    if (query.tier) {
      qb.andWhere('tp.status = :tier', { tier: query.tier });
    }
    if (query.dateFrom) {
      qb.andWhere('tp.created_at >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('tp.created_at <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.search) {
      qb.andWhere(
        '(profile_user.first_name ILIKE :search OR profile_user.last_name ILIKE :search OR profile_user.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.scoreMin !== undefined) {
      qb.andWhere(`(${latestScoreSubQuery}) >= :scoreMin`, {
        scoreMin: query.scoreMin,
      });
    }
    if (query.scoreMax !== undefined) {
      qb.andWhere(`(${latestScoreSubQuery}) <= :scoreMax`, {
        scoreMax: query.scoreMax,
      });
    }

    qb.addSelect('profile_user.first_name', 'first_name')
      .addSelect('profile_user.last_name', 'last_name')
      .addSelect('profile_user.email', 'email')
      .orderBy('tp.created_at', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    const [rawRows, total] = await Promise.all([
      qb.getRawMany<{
        tp_id: string;
        tp_track: string | null;
        tp_status: TalentProfileStatus;
        tp_created_at: Date;
        tp_updated_at: Date;
        first_name: string;
        last_name: string;
        email: string;
        latest_score: number | null;
      }>(),
      qb.getCount(),
    ]);

    const items: TalentListRow[] = rawRows.map((row) => ({
      id: row.tp_id,
      name: `${row.first_name} ${row.last_name}`.trim(),
      email: row.email,
      track: row.tp_track,
      tier: TIER_DISPLAY_LABELS[row.tp_status],
      latest_stage3_score:
        row.latest_score === null ? null : Number(row.latest_score),
      onboarding_date: row.tp_created_at,
      last_activity_date: row.tp_updated_at,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(talentProfileId: string) {
    const profile = await this.talentProfileRepo.findOne({
      where: { id: talentProfileId },
      relations: ['user'],
    });
    if (!profile) {
      throw new NotFoundException('Candidate not found');
    }

    const attempts = await this.assessmentAttemptRepo.find({
      where: { talent_profile_id: talentProfileId },
      order: { created_at: 'DESC' },
    });
    const skillAttempts = attempts.filter(
      (a) => a.assessment_type === AssessmentType.SKILL,
    );
    const advancedAttempts = attempts.filter(
      (a) => a.assessment_type === AssessmentType.ADVANCED,
    );

    const [skillResult, advancedResult] = await Promise.all([
      this.latestResultForAttempts(skillAttempts),
      this.latestResultForAttempts(advancedAttempts),
    ]);

    const violationCount = await this.assessmentScoreRepo.count({
      where: { talent_profile_id: talentProfileId, integrity_flag: true },
    });
    const voidedAttempts = attempts.filter((a) => a.force_submitted).length;
    const latestIntegrityConfidence =
      advancedResult?.integrity_confidence ??
      skillResult?.integrity_confidence ??
      null;

    const now = new Date();
    const isGated =
      profile.advanced_retake_required &&
      !!profile.assessment_locked_until &&
      profile.assessment_locked_until > now;

    return {
      profile_basics: {
        name: profile.user.fullname,
        email: profile.user.email,
        track: profile.track,
        region: profile.region,
        onboarding_date: profile.created_at,
      },
      stage1_summary: {
        specialisation: profile.track,
        tools_and_stack: profile.role_tracks,
        claimed_experience_level: profile.claimed_level,
        work_preferences: profile.availability_status,
      },
      stage2_result: {
        validated_level: profile.validated_level,
        score: skillResult?.percentage ?? null,
        retakes_used: Math.max(0, skillAttempts.length - 1),
        max_attempts: SKILL_ASSESSMENT_MAX_ATTEMPTS,
      },
      stage3_result: {
        score: advancedResult?.percentage ?? null,
        tier: advancedResult?.tier ?? null,
        retakes_used: Math.max(0, advancedAttempts.length - 1),
        retake_gate: isGated
          ? { locked_until: profile.assessment_locked_until }
          : null,
      },
      integrity_flags: {
        violation_count: violationCount,
        voided_attempts: voidedAttempts,
        confidence_level: latestIntegrityConfidence,
      },
      // No minor-assessment entity exists yet — empty per spec rather than
      // fabricated. Surfaced once that feature lands.
      minor_assessments: [],
      subscription_status: {
        free_retakes_remaining: Math.max(
          0,
          SKILL_ASSESSMENT_MAX_ATTEMPTS - skillAttempts.length,
        ),
      },
      verified_profile_link:
        profile.status === TalentProfileStatus.JOB_READY
          ? profile.profile_share_link
          : null,
    };
  }

  private async latestResultForAttempts(
    attempts: AssessmentAttempt[],
  ): Promise<AssessmentResult | null> {
    if (!attempts.length) return null;
    const attemptIds = attempts.map((a) => a.id);
    const results = await this.assessmentResultRepo.find({
      where: attemptIds.map((id) => ({ attempt_id: id })),
      order: { created_at: 'DESC' },
    });
    return results[0] ?? null;
  }
}
