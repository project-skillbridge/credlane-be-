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
  validatedLevel: VerifiedLevel;

  @ApiPropertyOptional({
    example: 82,
    description: 'Latest skill assessment score percentage, when available',
  })
  skillAssessmentPercentage?: number;
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

export class VerifiedProfileResponseDto {
  @ApiProperty({ example: 'Jane Doe' })
  fullName: string;

  @ApiProperty({ example: 'Frontend Developer' })
  role: string;

  @ApiProperty({ example: 'Land first role' })
  goal: string;

  @ApiProperty({
    example: 'Full-stack engineer focused on accessible React applications.',
  })
  about: string;

  @ApiPropertyOptional({
    example:
      'Jane is a frontend engineer with strong technical reasoning skills validated through multi-stage assessment.',
  })
  aiSummary?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatarUrl?: string | null;

  @ApiProperty({ example: true })
  verified: boolean;

  @ApiProperty({ example: 'job_ready' })
  status: string;

  @ApiPropertyOptional({ example: 'Mid Level' })
  seniorityBadge?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['React', 'TypeScript', 'Node.js'],
  })
  skills?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['React', 'TypeScript'],
  })
  verifiedSkills?: string[];

  @ApiPropertyOptional({ example: 85 })
  scorePercentage?: number;

  @ApiPropertyOptional({ example: 'Job Ready' })
  tierLabel?: string;

  @ApiPropertyOptional({ type: [VerifiedProfileStrengthDto] })
  keyStrengths?: VerifiedProfileStrengthDto[];

  @ApiPropertyOptional({ type: [VerifiedProfileSkillCategoryDto] })
  professionalSkills?: VerifiedProfileSkillCategoryDto[];

  @ApiPropertyOptional({ type: [VerifiedProfileSkillCategoryDto] })
  softSkills?: VerifiedProfileSkillCategoryDto[];

  @ApiPropertyOptional({ type: VerifiedProfileSkillProficiencyDto })
  skillProficiency?: VerifiedProfileSkillProficiencyDto;

  @ApiPropertyOptional({ type: VerifiedProfileDimensionScoreDto })
  workplaceReadiness?: VerifiedProfileDimensionScoreDto;

  @ApiPropertyOptional({ type: VerifiedProfileDimensionScoreDto })
  practicalApplication?: VerifiedProfileDimensionScoreDto;

  @ApiProperty({ example: 'https://skillbridge.com/verified-profiles/abc123' })
  shareUrl: string;

  @ApiPropertyOptional({
    example:
      'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://skillbridge.com/verified-profiles/abc123',
  })
  qrCodeUrl?: string;

  @ApiProperty({ example: true })
  isOwner: boolean;

  @ApiProperty({ example: '2026-05-03T12:00:00.000Z' })
  verifiedAt: string;

  @ApiPropertyOptional({
    example: 'job_ready',
    description: 'Advanced assessment tier at verification',
  })
  tier?: string;
}
