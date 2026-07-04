import { ApiProperty } from '@nestjs/swagger';

export class TrendIndicator {
  @ApiProperty({ enum: ['up', 'down', null], nullable: true, example: null })
  direction: 'up' | 'down' | null;

  @ApiProperty({ type: Number, nullable: true, example: null })
  change_percent: number | null;
}

export class StatCard {
  @ApiProperty({ example: 50, nullable: true })
  value: number | null;

  @ApiProperty({ type: TrendIndicator })
  trend: TrendIndicator;
}

export class EngagementPageStats {
  @ApiProperty({ type: StatCard })
  minor_assessment_adoption_rate: StatCard;

  @ApiProperty({ type: StatCard })
  minor_assessment_completion_rate: StatCard;

  @ApiProperty({ type: StatCard })
  retake_conversion_rate: StatCard;

  @ApiProperty({ type: StatCard })
  avg_time_to_retake_after_gate_clears_days: StatCard;
}

export class RetakeDropoffBucket {
  @ApiProperty({ example: 1 })
  attempt: number;

  @ApiProperty({ example: 12 })
  retakes: number;
}

export class RetakeDropoffResult {
  @ApiProperty({ type: [RetakeDropoffBucket] })
  buckets: RetakeDropoffBucket[];

  @ApiProperty({ example: false })
  empty: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Not enough retake data yet.',
  })
  empty_message: string | null;
}

export class MinorUptakeBucket {
  @ApiProperty({ example: 'language_variants' })
  type: string;

  @ApiProperty({ example: 0 })
  count: number;
}

export class MinorUptakeResult {
  @ApiProperty({ type: [MinorUptakeBucket] })
  buckets: MinorUptakeBucket[];

  @ApiProperty({ example: true })
  empty: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'No minor assessment data yet.',
  })
  empty_message: string | null;
}

export class AdminEngagementStatsResponse {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ type: EngagementPageStats })
  data: EngagementPageStats;
}

export class AdminEngagementRetakeDropoffResponse {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ type: RetakeDropoffResult })
  data: RetakeDropoffResult;
}

export class AdminEngagementMinorUptakeResponse {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ type: MinorUptakeResult })
  data: MinorUptakeResult;
}
