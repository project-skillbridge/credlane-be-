import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssessmentTier } from '../../assessments/entities/assessment-result.entity';
import { VerifiedLevel } from '../../assessments/entities/assessment-question.entity';

export enum DashboardJourneyStatus {
  AVAILABLE = 'available',
  COMPLETED = 'completed',
  LOCKED = 'locked',
}

export class JourneyOverviewItemDto {
  @ApiProperty({ example: 'onboarding' })
  key: string;

  @ApiProperty({ example: 'Onboarding' })
  title: string;

  @ApiProperty({
    enum: DashboardJourneyStatus,
    example: DashboardJourneyStatus.COMPLETED,
  })
  status: DashboardJourneyStatus;
}

export class DashboardSkillPerformanceDto {
  @ApiProperty({ example: 8 })
  score: number;

  @ApiProperty({ example: 10 })
  max_score: number;

  @ApiProperty({ example: 80, minimum: 0, maximum: 100 })
  percentage: number;

  @ApiProperty({ enum: VerifiedLevel, example: VerifiedLevel.MID })
  validated_level: VerifiedLevel;

  @ApiProperty({
    description:
      'Whether the skill assessment met the 50% quality gate and received a validated level',
  })
  passed: boolean;

  @ApiProperty({
    description:
      'True when overall score was below 50% (attempt does not count toward verification)',
  })
  failed: boolean;

  @ApiProperty({
    format: 'date-time',
    example: '2026-05-02T00:00:00.000Z',
  })
  completed_at: string;

  @ApiProperty({ example: 1, description: 'Number of skill attempts used' })
  attempts_used: number;

  @ApiProperty({ example: 2, description: 'Skill attempts remaining (max 3)' })
  attempts_remaining: number;
}

export class DashboardRetakeDto {
  @ApiProperty({
    format: 'date-time',
    example: '2026-05-03T00:00:00.000Z',
  })
  probation_start_date: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-05-17T00:00:00.000Z',
  })
  probation_end_date: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-05-17T00:00:00.000Z',
  })
  eligibility_date: string;

  @ApiProperty({
    description:
      'Whether the advanced assessment retake CTA can be enabled. False while the 14-day gate is active.',
  })
  cta_enabled: boolean;

  @ApiProperty({
    description: 'Seconds until eligibility. Zero once the gate has elapsed.',
    example: 86400,
  })
  countdown_seconds: number;

  @ApiProperty({
    description: 'Calendar days remaining, rounded up. Zero once eligible.',
    example: 1,
  })
  days_remaining: number;
}

export class DashboardAdvancedPerformanceDto {
  @ApiProperty({ example: 88 })
  score: number;

  @ApiProperty({ example: 110 })
  max_score: number;

  @ApiProperty({ example: 80, minimum: 0, maximum: 100 })
  percentage: number;

  @ApiProperty({ enum: AssessmentTier, example: AssessmentTier.JOB_READY })
  tier: AssessmentTier;

  @ApiProperty({ example: 'Job Ready' })
  tier_label: string;

  @ApiProperty({
    example: 'high',
    description: 'Integrity confidence from the scored attempt',
  })
  integrity_confidence: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-05-03T00:00:00.000Z',
  })
  completed_at: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'AI guidance report generated asynchronously after advanced submit. Emerging reports include retake_advice; Job Ready reports omit it.',
  })
  guidance_report?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: () => DashboardRetakeDto,
    nullable: true,
    description:
      'Nested advanced retake metadata when an advanced retake gate exists for this completed result.',
  })
  retake?: DashboardRetakeDto | null;
}

export class DashboardPerformanceDto {
  @ApiPropertyOptional({
    type: DashboardSkillPerformanceDto,
    nullable: true,
  })
  skill: DashboardSkillPerformanceDto | null;

  @ApiPropertyOptional({
    type: DashboardAdvancedPerformanceDto,
    nullable: true,
  })
  advanced: DashboardAdvancedPerformanceDto | null;
}

export class DashboardHomeResponseDto {
  @ApiProperty({ example: 'Jane' })
  first_name: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/avatar.png',
    nullable: true,
    description: "The talent's current profile photo URL.",
  })
  avatar_url: string | null;

  @ApiPropertyOptional({
    example: 'Get a remote job',
    nullable: true,
    description: "The talent's stated career goal.",
  })
  goal: string | null;

  @ApiProperty({ example: 72, minimum: 0, maximum: 100 })
  profile_completion_percentage: number;

  @ApiProperty({ type: [JourneyOverviewItemDto] })
  journey_overview: JourneyOverviewItemDto[];

  @ApiProperty({ type: DashboardPerformanceDto })
  performance: DashboardPerformanceDto;

  @ApiProperty({
    example: 1,
    minimum: 0,
    description:
      'Number of completed skill assessment attempts for the current user. Use with skill_max_attempts to display e.g. "1/3".',
  })
  skill_attempts_used: number;

  @ApiProperty({
    example: 3,
    description:
      'Maximum skill assessment attempts allowed before advanced assessment is required.',
  })
  skill_max_attempts: number;

  @ApiPropertyOptional({
    type: () => DashboardRetakeDto,
    nullable: true,
    description:
      'Top-level advanced retake metadata. Present only when assessment_locked_until is marked as an advanced retake gate.',
  })
  advanced_retake?: DashboardRetakeDto | null;
}

export type DashboardSkillPerformance = {
  score: number;
  max_score: number;
  percentage: number;
  validated_level: VerifiedLevel;
  passed: boolean;
  failed: boolean;
  completed_at: string;
  attempts_used: number;
  attempts_remaining: number;
};

export type DashboardAdvancedPerformance = {
  score: number;
  max_score: number;
  percentage: number;
  tier: AssessmentTier;
  tier_label: string;
  integrity_confidence: string;
  completed_at: string;
  retake?: DashboardRetake | null;
};

export type DashboardPerformance = {
  skill: DashboardSkillPerformance | null;
  advanced: DashboardAdvancedPerformance | null;
};

export type DashboardHomeResponse = {
  first_name: string;
  avatar_url: string | null;
  goal: string | null;
  profile_completion_percentage: number;
  journey_overview: JourneyOverviewItemDto[];
  performance: DashboardPerformance;
  skill_attempts_used: number;
  skill_max_attempts: number;
  advanced_retake?: DashboardRetake | null;
};

export type DashboardRetake = {
  probation_start_date: string;
  probation_end_date: string;
  eligibility_date: string;
  cta_enabled: boolean;
  countdown_seconds: number;
  days_remaining: number;
};
