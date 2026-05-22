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
  maxScore: number;

  @ApiProperty({ example: 80, minimum: 0, maximum: 100 })
  percentage: number;

  @ApiProperty({ enum: VerifiedLevel, example: VerifiedLevel.MID })
  validatedLevel: VerifiedLevel;

  @ApiProperty({
    description:
      'Whether the skill assessment met the 70% pass gate for advanced',
  })
  passed: boolean;

  @ApiProperty({
    format: 'date-time',
    example: '2026-05-02T00:00:00.000Z',
  })
  completedAt: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'AI guidance report. Emerging reports include retake_advice; Job Ready reports are strengths-focused and omit retake_advice.',
  })
  guidanceReport?: Record<string, unknown> | null;
}

export class DashboardRetakeDto {
  @ApiProperty({
    format: 'date-time',
    example: '2026-05-17T00:00:00.000Z',
  })
  eligibilityDate: string;

  @ApiProperty({
    description:
      'Whether the advanced assessment retake CTA can be enabled. False while the 14-day gate is active.',
  })
  ctaEnabled: boolean;

  @ApiProperty({
    description: 'Seconds until eligibility. Zero once the gate has elapsed.',
    example: 86400,
  })
  countdownSeconds: number;

  @ApiProperty({
    description: 'Calendar days remaining, rounded up. Zero once eligible.',
    example: 1,
  })
  daysRemaining: number;
}

export class DashboardAdvancedPerformanceDto {
  @ApiProperty({ example: 88 })
  score: number;

  @ApiProperty({ example: 110 })
  maxScore: number;

  @ApiProperty({ example: 80, minimum: 0, maximum: 100 })
  percentage: number;

  @ApiProperty({ enum: AssessmentTier, example: AssessmentTier.JOB_READY })
  tier: AssessmentTier;

  @ApiProperty({ example: 'Job Ready' })
  tierLabel: string;

  @ApiProperty({
    example: 'high',
    description: 'Integrity confidence from the scored attempt',
  })
  integrityConfidence: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-05-03T00:00:00.000Z',
  })
  completedAt: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'AI guidance report generated asynchronously after advanced submit. Emerging reports include retake_advice; Job Ready reports omit it.',
  })
  guidanceReport?: Record<string, unknown> | null;

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
  firstName: string;

  @ApiProperty({ example: 72, minimum: 0, maximum: 100 })
  profileCompletionPercentage: number;

  @ApiProperty({ type: [JourneyOverviewItemDto] })
  journeyOverview: JourneyOverviewItemDto[];

  @ApiProperty({ type: DashboardPerformanceDto })
  performance: DashboardPerformanceDto;

  @ApiPropertyOptional({
    type: () => DashboardRetakeDto,
    nullable: true,
    description:
      'Top-level advanced retake metadata. Present only when assessment_locked_until is marked as an advanced retake gate.',
  })
  advancedRetake?: DashboardRetakeDto | null;
}

export type DashboardSkillPerformance = {
  score: number;
  maxScore: number;
  percentage: number;
  validatedLevel: VerifiedLevel;
  passed: boolean;
  completedAt: string;
  guidanceReport?: Record<string, unknown> | null;
};

export type DashboardAdvancedPerformance = {
  score: number;
  maxScore: number;
  percentage: number;
  tier: AssessmentTier;
  tierLabel: string;
  integrityConfidence: string;
  completedAt: string;
  guidanceReport?: Record<string, unknown> | null;
  retake?: DashboardRetake | null;
};

export type DashboardPerformance = {
  skill: DashboardSkillPerformance | null;
  advanced: DashboardAdvancedPerformance | null;
};

export type DashboardHomeResponse = {
  firstName: string;
  profileCompletionPercentage: number;
  journeyOverview: JourneyOverviewItemDto[];
  performance: DashboardPerformance;
  advancedRetake?: DashboardRetake | null;
};

export type DashboardRetake = {
  eligibilityDate: string;
  ctaEnabled: boolean;
  countdownSeconds: number;
  daysRemaining: number;
};
