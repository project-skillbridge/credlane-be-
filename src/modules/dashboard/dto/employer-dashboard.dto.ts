import { ApiProperty } from '@nestjs/swagger';

export enum EmployerDashboardViewState {
  NEW_USER = 'new_user',
  EXISTING_USER = 'existing_user',
}

export enum EmployerDashboardActivityType {
  VERIFIED_TALENT = 'verified_talent',
  SHORTLIST = 'shortlist',
  OFFER_ACCEPTED = 'offer_accepted',
}

export class EmployerDashboardProfilePromptDto {
  @ApiProperty({ example: true })
  show_prompt: boolean;

  @ApiProperty({ example: false })
  is_verified: boolean;

  @ApiProperty({ example: 40, minimum: 0, maximum: 100 })
  completion_percentage: number;

  @ApiProperty({
    type: [String],
    example: ['Add your company name', 'Add your company LinkedIn page'],
  })
  missing_items: string[];
}

export class EmployerDashboardOverviewCountsDto {
  @ApiProperty({ example: 6 })
  verified_talent: number;

  @ApiProperty({ example: 0 })
  created_assessments: number;

  @ApiProperty({ example: 0 })
  shortlisted_candidates: number;

  @ApiProperty({ example: 0 })
  my_roles: number;
}

export class EmployerDashboardActivityDto {
  @ApiProperty({ example: 'act_saved-1' })
  id: string;

  @ApiProperty({
    enum: EmployerDashboardActivityType,
    example: EmployerDashboardActivityType.VERIFIED_TALENT,
  })
  type: EmployerDashboardActivityType;

  @ApiProperty({ example: '3 new verified Backend Developer candidates added' })
  title: string;

  @ApiProperty({
    example: 'Fresh Job Ready talent now matches your hiring preferences.',
  })
  description: string;

  @ApiProperty({ format: 'date-time' })
  occurred_at: string;
}

export class EmployerDashboardHomeResponseDto {
  @ApiProperty({ example: 'Lisan Al Gaib' })
  company_name: string;

  @ApiProperty({
    enum: EmployerDashboardViewState,
    example: EmployerDashboardViewState.NEW_USER,
  })
  view_state: EmployerDashboardViewState;

  @ApiProperty({ type: EmployerDashboardProfilePromptDto })
  profile_prompt: EmployerDashboardProfilePromptDto;

  @ApiProperty({ type: EmployerDashboardOverviewCountsDto })
  overview_counts: EmployerDashboardOverviewCountsDto;

  @ApiProperty({ type: [EmployerDashboardActivityDto] })
  recent_activity: EmployerDashboardActivityDto[];
}

export class EmployerDashboardEnvelopeResponseDto {
  @ApiProperty({ example: 200 })
  status_code: number;

  @ApiProperty({ type: EmployerDashboardHomeResponseDto })
  data: EmployerDashboardHomeResponseDto;
}

export type EmployerDashboardProfilePrompt = {
  show_prompt: boolean;
  is_verified: boolean;
  completion_percentage: number;
  missing_items: string[];
};

export type EmployerDashboardOverviewCounts = {
  verified_talent: number;
  created_assessments: number;
  shortlisted_candidates: number;
  my_roles: number;
};

export type EmployerDashboardActivity = {
  id: string;
  type: EmployerDashboardActivityType;
  title: string;
  description: string;
  occurred_at: string;
};

export type EmployerDashboardHomeResponse = {
  company_name: string;
  view_state: EmployerDashboardViewState;
  profile_prompt: EmployerDashboardProfilePrompt;
  overview_counts: EmployerDashboardOverviewCounts;
  recent_activity: EmployerDashboardActivity[];
};

