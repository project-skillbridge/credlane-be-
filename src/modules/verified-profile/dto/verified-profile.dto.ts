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
    type: [String],
    example: ['React', 'TypeScript', 'Node.js'],
  })
  skills?: string[];

  @ApiPropertyOptional({ type: VerifiedProfileSkillProficiencyDto })
  skillProficiency?: VerifiedProfileSkillProficiencyDto;

  @ApiPropertyOptional({ type: VerifiedProfileDimensionScoreDto })
  workplaceReadiness?: VerifiedProfileDimensionScoreDto;

  @ApiPropertyOptional({ type: VerifiedProfileDimensionScoreDto })
  practicalApplication?: VerifiedProfileDimensionScoreDto;

  @ApiProperty({ example: '2026-05-03T12:00:00.000Z' })
  verifiedAt: string;

  @ApiPropertyOptional({
    example: 'job_ready',
    description: 'Advanced assessment tier at verification',
  })
  tier?: string;
}
