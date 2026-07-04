import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentAttempt } from '../../assessments/entities/assessment-attempt.entity';
import { AssessmentType } from '../../assessments/entities/assessment-question.entity';
import type { StatCard, TrendIndicator } from '../overview/admin-overview.service';

export interface EngagementStats {
  minor_assessment_adoption_rate: StatCard;
  minor_assessment_completion_rate: StatCard;
  retake_conversion_rate: StatCard;
  avg_time_to_retake_days: StatCard;
}

export interface RetakeDropoffResult {
  buckets: { attempt_number: number; count: number }[];
  total_candidates_with_attempts: number;
  empty: boolean;
  empty_message: string | null;
}

export interface MinorUptakeResult {
  buckets: { type: string; count: number }[];
  empty: boolean;
  empty_message: string | null;
}

const TREND_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_RETAKE_CANDIDATES = 10;

@Injectable()
export class AdminEngagementService {
  constructor(
    @InjectRepository(AssessmentAttempt)
    private readonly attemptRepo: Repository<AssessmentAttempt>,
  ) {}

  async getStats(): Promise<EngagementStats> {
    const now = new Date();
    const periodStart = new Date(now.getTime() - TREND_WINDOW_MS);
    const priorPeriodStart = new Date(periodStart.getTime() - TREND_WINDOW_MS);

    const [retakeNow, retakePrior, avgDaysNow, avgDaysPrior] =
      await Promise.all([
        this.computeRetakeConversionRate(periodStart, now),
        this.computeRetakeConversionRate(priorPeriodStart, periodStart),
        this.computeAvgTimeToRetakeDays(periodStart, now),
        this.computeAvgTimeToRetakeDays(priorPeriodStart, periodStart),
      ]);

    return {
      minor_assessment_adoption_rate: {
        value: 0,
        trend: { direction: null, change_percent: null },
      },
      minor_assessment_completion_rate: {
        value: 0,
        trend: { direction: null, change_percent: null },
      },
      retake_conversion_rate: {
        value: retakeNow,
        trend: this.computeTrend(retakeNow, retakePrior),
      },
      avg_time_to_retake_days: {
        value: avgDaysNow ?? 0,
        trend: avgDaysNow !== null && avgDaysPrior !== null
          ? this.computeTrend(avgDaysNow, avgDaysPrior)
          : { direction: null, change_percent: null },
      },
    };
  }

  async getRetakeDropoff(): Promise<RetakeDropoffResult> {
    const rows = await this.attemptRepo.query<
      { attempt_number: string; count: string }[]
    >(
      `
      WITH ranked AS (
        SELECT
          talent_profile_id,
          ROW_NUMBER() OVER (
            PARTITION BY talent_profile_id ORDER BY started_at
          ) AS attempt_number
        FROM assessment_attempts
        WHERE assessment_type = $1
          AND completed_at IS NOT NULL
      )
      SELECT attempt_number::int, COUNT(DISTINCT talent_profile_id)::text AS count
      FROM ranked
      GROUP BY attempt_number
      ORDER BY attempt_number
      `,
      [AssessmentType.ADVANCED],
    );

    const totalCandidates =
      rows.length > 0 ? Number(rows[0].count) : 0;

    if (totalCandidates < MIN_RETAKE_CANDIDATES) {
      return {
        buckets: [],
        total_candidates_with_attempts: totalCandidates,
        empty: true,
        empty_message: 'Not enough retake data yet.',
      };
    }

    return {
      buckets: rows.map((r) => ({
        attempt_number: Number(r.attempt_number),
        count: Number(r.count),
      })),
      total_candidates_with_attempts: totalCandidates,
      empty: false,
      empty_message: null,
    };
  }

  getMinorUptake(_track?: string): MinorUptakeResult {
    return {
      buckets: [],
      empty: true,
      empty_message: 'No minor assessment data yet.',
    };
  }

  private async computeRetakeConversionRate(
    start: Date,
    end: Date,
  ): Promise<number> {
    const rows = await this.attemptRepo.query<
      { total: string; retakers: string }[]
    >(
      `
      WITH counts AS (
        SELECT talent_profile_id, COUNT(*) AS attempt_count
        FROM assessment_attempts
        WHERE assessment_type = $1
          AND started_at >= $2
          AND started_at < $3
        GROUP BY talent_profile_id
      )
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE attempt_count >= 2)::text AS retakers
      FROM counts
      `,
      [AssessmentType.ADVANCED, start, end],
    );

    const total = Number(rows[0]?.total ?? 0);
    const retakers = Number(rows[0]?.retakers ?? 0);
    if (total === 0) return 0;
    return Math.round((retakers / total) * 1000) / 10;
  }

  private async computeAvgTimeToRetakeDays(
    start: Date,
    end: Date,
  ): Promise<number | null> {
    const rows = await this.attemptRepo.query<{ avg_days: string | null }[]>(
      `
      WITH ranked AS (
        SELECT
          talent_profile_id,
          started_at,
          LAG(started_at) OVER (
            PARTITION BY talent_profile_id ORDER BY started_at
          ) AS prev_started_at
        FROM assessment_attempts
        WHERE assessment_type = $1
          AND started_at >= $2
          AND started_at < $3
      )
      SELECT AVG(
        EXTRACT(EPOCH FROM (started_at - prev_started_at)) / 86400.0
      )::text AS avg_days
      FROM ranked
      WHERE prev_started_at IS NOT NULL
      `,
      [AssessmentType.ADVANCED, start, end],
    );

    const avg = rows[0]?.avg_days;
    if (avg === null || avg === undefined) return null;
    return Math.round(Number(avg) * 10) / 10;
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
