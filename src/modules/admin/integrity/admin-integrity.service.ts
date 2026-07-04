import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentAttempt } from '../../assessments/entities/assessment-attempt.entity';
import { AssessmentScore } from '../../assessments/entities/assessment-score.entity';
import { ListVoidedAttemptsQueryDto } from './dto/list-voided-attempts-query.dto';

export interface TrendIndicator {
  direction: 'up' | 'down' | null;
  change_percent: number | null;
}

export interface StatCard {
  value: number;
  trend: TrendIndicator;
}

export interface IntegrityStats {
  flagged_attempts: StatCard;
  voided_attempts: StatCard;
  high_confidence_flags: StatCard;
  violation_rate_percent: StatCard;
}

export interface VoidedAttemptRow {
  id: string;
  talent_name: string;
  talent_email: string;
  track: string | null;
  assessment_type: string;
  tab_switch_count: number;
  copy_paste_count: number;
  violation_count: number;
  highest_confidence: 'high' | 'medium' | 'low' | null;
  started_at: Date;
  completed_at: Date | null;
}

const TREND_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const CONFIDENCE_RANK: Record<'high' | 'medium' | 'low', number> = {
  high: 3,
  medium: 2,
  low: 1,
};

@Injectable()
export class AdminIntegrityService {
  constructor(
    @InjectRepository(AssessmentAttempt)
    private readonly attemptRepo: Repository<AssessmentAttempt>,
    @InjectRepository(AssessmentScore)
    private readonly scoreRepo: Repository<AssessmentScore>,
  ) {}

  async getStats(): Promise<IntegrityStats> {
    const now = new Date();
    const periodStart = new Date(now.getTime() - TREND_WINDOW_MS);
    const priorPeriodStart = new Date(periodStart.getTime() - TREND_WINDOW_MS);

    const [
      flaggedNow,
      flaggedPrior,
      voidedNow,
      voidedPrior,
      highConfidenceNow,
      highConfidencePrior,
      completedNow,
      completedPrior,
    ] = await Promise.all([
      this.countDistinctFlaggedAttempts(periodStart, now),
      this.countDistinctFlaggedAttempts(priorPeriodStart, periodStart),
      this.attemptRepo
        .createQueryBuilder('a')
        .where('a.force_submitted = true')
        .andWhere('a.created_at >= :start', { start: periodStart })
        .andWhere('a.created_at < :end', { end: now })
        .getCount(),
      this.attemptRepo
        .createQueryBuilder('a')
        .where('a.force_submitted = true')
        .andWhere('a.created_at >= :start', { start: priorPeriodStart })
        .andWhere('a.created_at < :end', { end: periodStart })
        .getCount(),
      this.countDistinctFlaggedAttempts(periodStart, now, 'high'),
      this.countDistinctFlaggedAttempts(priorPeriodStart, periodStart, 'high'),
      this.attemptRepo
        .createQueryBuilder('a')
        .where('a.completed_at IS NOT NULL')
        .andWhere('a.created_at >= :start', { start: periodStart })
        .andWhere('a.created_at < :end', { end: now })
        .getCount(),
      this.attemptRepo
        .createQueryBuilder('a')
        .where('a.completed_at IS NOT NULL')
        .andWhere('a.created_at >= :start', { start: priorPeriodStart })
        .andWhere('a.created_at < :end', { end: periodStart })
        .getCount(),
    ]);

    const violationRateNow = this.toPercent(flaggedNow, completedNow);
    const violationRatePrior = this.toPercent(flaggedPrior, completedPrior);

    return {
      flagged_attempts: {
        value: flaggedNow,
        trend: this.computeTrend(flaggedNow, flaggedPrior),
      },
      voided_attempts: {
        value: voidedNow,
        trend: this.computeTrend(voidedNow, voidedPrior),
      },
      high_confidence_flags: {
        value: highConfidenceNow,
        trend: this.computeTrend(highConfidenceNow, highConfidencePrior),
      },
      violation_rate_percent: {
        value: violationRateNow,
        trend: this.computeTrend(violationRateNow, violationRatePrior),
      },
    };
  }

  async findVoidedAttempts(query: ListVoidedAttemptsQueryDto): Promise<{
    items: VoidedAttemptRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.attemptRepo
      .createQueryBuilder('a')
      .innerJoin('a.talent_profile', 'tp')
      .innerJoin('tp.user', 'profile_user')
      .where('a.force_submitted = true')
      .orderBy('a.created_at', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    if (query.assessmentType) {
      qb.andWhere('a.assessment_type = :assessmentType', {
        assessmentType: query.assessmentType,
      });
    }
    if (query.dateFrom) {
      qb.andWhere('a.created_at >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('a.created_at <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.search) {
      qb.andWhere(
        '(profile_user.first_name ILIKE :search OR profile_user.last_name ILIKE :search OR profile_user.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.addSelect('tp.track', 'tp_track')
      .addSelect('profile_user.first_name', 'first_name')
      .addSelect('profile_user.last_name', 'last_name')
      .addSelect('profile_user.email', 'email');

    const [rawRows, total] = await Promise.all([
      qb.getRawMany<{
        a_id: string;
        a_assessment_type: string;
        a_tab_switch_count: number;
        a_copy_paste_count: number;
        a_started_at: Date;
        a_completed_at: Date | null;
        tp_track: string | null;
        first_name: string;
        last_name: string;
        email: string;
      }>(),
      qb.getCount(),
    ]);

    const attemptIds = rawRows.map((row) => row.a_id);
    const violationsByAttempt =
      attemptIds.length > 0
        ? await this.violationSummaryForAttempts(attemptIds)
        : new Map<
            string,
            {
              count: number;
              highestConfidence: 'high' | 'medium' | 'low' | null;
            }
          >();

    const items: VoidedAttemptRow[] = rawRows.map((row) => {
      const violations = violationsByAttempt.get(row.a_id);
      return {
        id: row.a_id,
        talent_name: `${row.first_name} ${row.last_name}`.trim(),
        talent_email: row.email,
        track: row.tp_track,
        assessment_type: row.a_assessment_type,
        tab_switch_count: row.a_tab_switch_count,
        copy_paste_count: row.a_copy_paste_count,
        violation_count: violations?.count ?? 0,
        highest_confidence: violations?.highestConfidence ?? null,
        started_at: row.a_started_at,
        completed_at: row.a_completed_at,
      };
    });

    return { items, total, page, limit };
  }

  private async violationSummaryForAttempts(
    attemptIds: string[],
  ): Promise<
    Map<
      string,
      { count: number; highestConfidence: 'high' | 'medium' | 'low' | null }
    >
  > {
    const scores = await this.scoreRepo
      .createQueryBuilder('s')
      .where('s.attempt_id IN (:...attemptIds)', { attemptIds })
      .andWhere('s.integrity_flag = true')
      .getMany();

    const summary = new Map<
      string,
      { count: number; highestConfidence: 'high' | 'medium' | 'low' | null }
    >();

    for (const score of scores) {
      const existing = summary.get(score.attempt_id) ?? {
        count: 0,
        highestConfidence: null,
      };
      existing.count += 1;
      if (
        score.integrity_confidence &&
        (!existing.highestConfidence ||
          CONFIDENCE_RANK[score.integrity_confidence] >
            CONFIDENCE_RANK[existing.highestConfidence])
      ) {
        existing.highestConfidence = score.integrity_confidence;
      }
      summary.set(score.attempt_id, existing);
    }

    return summary;
  }

  private async countDistinctFlaggedAttempts(
    start: Date,
    end: Date,
    confidence?: 'high',
  ): Promise<number> {
    const qb = this.scoreRepo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.attempt_id)', 'count')
      .where('s.integrity_flag = true')
      .andWhere('s.created_at >= :start', { start })
      .andWhere('s.created_at < :end', { end });

    if (confidence) {
      qb.andWhere('s.integrity_confidence = :confidence', { confidence });
    }

    const result = await qb.getRawOne<{ count: string }>();
    return Number(result?.count ?? 0);
  }

  private toPercent(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
  }

  private computeTrend(current: number, prior: number): TrendIndicator {
    if (prior === 0) {
      if (current === 0) return { direction: null, change_percent: null };
      return { direction: 'up', change_percent: 100 };
    }
    const changePercent = Math.round(((current - prior) / prior) * 1000) / 10;
    return {
      direction: changePercent === 0 ? null : changePercent > 0 ? 'up' : 'down',
      change_percent: changePercent,
    };
  }
}
