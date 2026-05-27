import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VerifiedLevel } from '../../assessments/entities/assessment-question.entity';

export class VerifiedProfileDimensionScoreDto {
  @ApiProperty({ example: 78 })
  percentage: number;

  @ApiProperty({ example: 'Workplace Readiness' })
  label: string;
}

export class VerifiedProfileSkillProficiencyDto {
  @ApiProperty({ enum: VerifiedLevel, example: VerifiedLevel.MID })
  validated_level: VerifiedLevel;

  @ApiPropertyOptional({
    example: 82,
    description: 'Latest skill assessment score percentage, when available',
  })
  skill_assessment_percentage?: number;
}

export class VerifiedProfileStrengthDto {
  @ApiProperty({ example: 'technical_reasoning' })
  competency: string;

  @ApiProperty({ example: 'Technical Reasoning' })
  label: string;

  @ApiProperty({ example: 92 })
  percentage: number;
}

export class VerifiedProfileSkillCategoryDto {
  @ApiProperty({ example: 'Technical Reasoning' })
  label: string;

  @ApiProperty({ example: 92 })
  percentage: number;
}

export class VerifiedProfileRatedItemDto {
  @ApiProperty({ example: 'Clear practical problem solving.' })
  label: string;

  @ApiProperty({ example: 3 })
  rating: number;
}

export class VerifiedProfileAssessmentInsightDto {
  @ApiProperty({ example: 'Skill Proficiency' })
  label: string;

  @ApiProperty({
    example:
      'You showed job-ready strengths across the latest assessment attempt.',
  })
  insight: string;
}

export class VerifiedProfileAssessmentInsightsDto {
  @ApiPropertyOptional({ type: VerifiedProfileAssessmentInsightDto })
  skill_proficiency?: VerifiedProfileAssessmentInsightDto;

  @ApiPropertyOptional({ type: VerifiedProfileAssessmentInsightDto })
  workplace_readiness?: VerifiedProfileAssessmentInsightDto;

  @ApiPropertyOptional({ type: VerifiedProfileAssessmentInsightDto })
  practical_application?: VerifiedProfileAssessmentInsightDto;
}

export class VerifiedProfileResourceDto {
  @ApiProperty({ example: 'MDN React Docs' })
  title: string;

  @ApiProperty({ example: 'MDN' })
  provider: string;

  @ApiProperty({ example: 'https://developer.mozilla.org/' })
  url: string;

  @ApiProperty({ enum: ['free', 'paid'], example: 'free' })
  tier: 'free' | 'paid';

  @ApiProperty({ example: 'api_design' })
  competency: string;

  @ApiProperty({ example: 'This resource supports the candidate growth area.' })
  reason: string;
}

export class VerifiedProfileResponseDto {
  @ApiProperty({ example: 'Jane Doe' })
  full_name: string;

  @ApiProperty({ example: 'Frontend Developer' })
  role: string;

  @ApiProperty({ example: 'Land first role' })
  goal: string;

  @ApiProperty({
    example: 'Full-stack engineer focused on accessible React applications.',
  })
  about: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Mid Level', 'Job Ready', 'Fully Remote', '3-5 yrs exp.'],
    description:
      'Badge-style report facts used by the verified profile UI header.',
  })
  about_tags?: string[];

  @ApiPropertyOptional({
    example:
      'Jane is a frontend engineer with strong technical reasoning skills validated through multi-stage assessment.',
  })
  ai_summary?: string;

  @ApiPropertyOptional({
    example:
      'Jane is a frontend engineer with strong technical reasoning skills validated through multi-stage assessment.',
    description:
      'Report-facing alias for ai_summary used by the verified profile UI.',
  })
  ai_report?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatar_url?: string | null;

  @ApiProperty({ example: true })
  verified: boolean;

  @ApiProperty({ example: 'job_ready' })
  status: string;

  @ApiPropertyOptional({ example: 'Mid Level' })
  seniority_badge?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['React', 'TypeScript', 'Node.js'],
  })
  skills?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['React', 'TypeScript'],
  })
  verified_skills?: string[];

  @ApiPropertyOptional({ example: 85 })
  score_percentage?: number;

  @ApiPropertyOptional({ example: 'Job Ready' })
  tier_label?: string;

  @ApiPropertyOptional({ type: [VerifiedProfileStrengthDto] })
  key_strengths?: VerifiedProfileStrengthDto[];

  @ApiPropertyOptional({ type: [VerifiedProfileSkillCategoryDto] })
  professional_skills?: VerifiedProfileSkillCategoryDto[];

  @ApiPropertyOptional({ type: [VerifiedProfileSkillCategoryDto] })
  soft_skills?: VerifiedProfileSkillCategoryDto[];

  @ApiPropertyOptional({
    type: [String],
    example: ['Fully Remote', 'Async Collaboration', 'Small Teams'],
  })
  working_style?: string[];

  @ApiPropertyOptional({
    example:
      'Your recent assessments show steady progress in structured thinking.',
  })
  growth_insight?: string;

  @ApiPropertyOptional({ type: [VerifiedProfileRatedItemDto] })
  strength_ratings?: VerifiedProfileRatedItemDto[];

  @ApiPropertyOptional({ type: [VerifiedProfileRatedItemDto] })
  weaknesses?: VerifiedProfileRatedItemDto[];

  @ApiPropertyOptional({ type: VerifiedProfileSkillProficiencyDto })
  skill_proficiency?: VerifiedProfileSkillProficiencyDto;

  @ApiPropertyOptional({ type: VerifiedProfileDimensionScoreDto })
  workplace_readiness?: VerifiedProfileDimensionScoreDto;

  @ApiPropertyOptional({ type: VerifiedProfileDimensionScoreDto })
  practical_application?: VerifiedProfileDimensionScoreDto;

  @ApiPropertyOptional({ type: VerifiedProfileAssessmentInsightsDto })
  assessment_insights?: VerifiedProfileAssessmentInsightsDto;

  @ApiPropertyOptional({ type: [VerifiedProfileResourceDto] })
  recommended_resources?: VerifiedProfileResourceDto[];

  @ApiPropertyOptional({ example: '/resources' })
  resource_page_url?: '/resources';

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description:
      'Reserved for a future downloadable CV/resume URL. Currently null until resume storage is available.',
  })
  download_cv_url?: string | null;

  @ApiProperty({ example: 'https://skillbridge.com/verified-profiles/abc123' })
  share_url: string;

  @ApiPropertyOptional({
    example:
      'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://skillbridge.com/verified-profiles/abc123',
  })
  qr_code_url?: string;

  @ApiProperty({ example: true })
  is_owner: boolean;

  @ApiProperty({ example: '2026-05-03T12:00:00.000Z' })
  verified_at: string;

  @ApiPropertyOptional({
    example: 'job_ready',
    description: 'Advanced assessment tier at verification',
  })
  tier?: string;
}
