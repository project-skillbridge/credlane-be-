import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class SavePersonalAssessmentSectionDto {
  @ApiProperty({
    description:
      'Answers keyed by question field name. Onboarding-covered fields (track, educationLevel, region, linkedinProfile, claimedLevel) are ignored.',
    example: {
      job_title: 'Software Engineer',
      years_experience: '3_5_yrs',
      industries: ['fintech'],
    },
  })
  @IsObject()
  answers: Record<string, unknown>;
}
