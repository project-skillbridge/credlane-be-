import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { VerifiedLevel } from '../../assessments/entities/assessment-question.entity';

export class VerifiedProfileAssessmentBreakdownItemDto {
  @ApiProperty({ example: 'skill_proficiency' })
  id: string;

  @ApiProperty({ example: 'Skill Proficiency' })
  label: string;

  @ApiProperty({ example: 86 })
  percentage: number;

  @ApiPropertyOptional({ enum: VerifiedLevel, example: VerifiedLevel.MID })
  validated_level?: string;

  @ApiProperty()
  insight: string;
}

export class VerifiedProfileSkillBreakdownItemDto {
  @ApiProperty({ example: 'Technical Reasoning' })
  label: string;

  @ApiProperty({ example: 93 })
  percentage: number;

  @ApiPropertyOptional({ example: 'technical_reasoning' })
  competency?: string;

  @ApiPropertyOptional()
  insight?: string;
}

@ApiExtraModels(
  VerifiedProfileAssessmentBreakdownItemDto,
  VerifiedProfileSkillBreakdownItemDto,
)
export class VerifiedProfileSkillBreakdownTabDto {
  @ApiProperty({ example: 'assessment_scores' })
  id: string;

  @ApiProperty({ example: 'Assessment Scores' })
  label: string;

  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(VerifiedProfileAssessmentBreakdownItemDto) },
        { $ref: getSchemaPath(VerifiedProfileSkillBreakdownItemDto) },
      ],
    },
  })
  items: (
    | VerifiedProfileAssessmentBreakdownItemDto
    | VerifiedProfileSkillBreakdownItemDto
  )[];
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

  @ApiProperty({
    type: [String],
    example: ['Mid Level', 'Job Ready', 'Open to Work', 'Fully Remote'],
  })
  about_tags: string[];

  @ApiProperty({ example: 'https://example.com/avatar.jpg', nullable: true })
  avatar_url: string | null;

  @ApiProperty({ example: true })
  verified: boolean;

  @ApiProperty({ example: 'job_ready' })
  status: string;

  @ApiProperty({ example: 'Mid Level' })
  seniority_badge: string;

  @ApiProperty({ example: 'job_ready' })
  tier: string;

  @ApiProperty({ example: 'Job Ready' })
  tier_label: string;

  @ApiProperty({ example: 85 })
  score_percentage: number;

  @ApiProperty({ example: '2026-05-03T12:00:00.000Z' })
  verified_at: string;

  @ApiProperty({ example: true })
  is_owner: boolean;

  @ApiProperty({ type: [String], example: ['React', 'TypeScript'] })
  skills: string[];

  @ApiProperty({
    type: [String],
    example: ['Fully Remote', 'Async Collaboration'],
  })
  working_style: string[];

  @ApiProperty({
    description: 'AI-generated report text used by the verified profile UI.',
  })
  ai_report: string;

  @ApiProperty()
  growth_insight: string;

  @ApiProperty({ type: [VerifiedProfileSkillBreakdownTabDto] })
  skill_breakdown_tabs: VerifiedProfileSkillBreakdownTabDto[];

  @ApiProperty({ type: [VerifiedProfileResourceDto] })
  recommended_resources: VerifiedProfileResourceDto[];

  @ApiProperty({ example: '/resources' })
  resource_page_url: '/resources';

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({
    example: 'https://cdn.example.com/resumes/resume.pdf',
    nullable: true,
  })
  resume_url: string | null;

  @ApiProperty({ example: 'https://skillbridge.com/verified-profiles/abc123' })
  share_url: string;

  @ApiProperty({ nullable: true })
  qr_code_url: string | null;
}
