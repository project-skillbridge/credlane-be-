import { ApiProperty } from '@nestjs/swagger';

export enum EmployerDashboardViewState {
  NEW_USER = 'new_user',
  EXISTING_USER = 'existing_user',
}

export enum EmployerDashboardActivityType {
  VERIFIED_TALENT = 'verified_talent',
  SHORTLIST = 'shortlist',
  OFFER_ACCEPTED = 'offer_accepted',
  ROLE_CREATED = 'role_created',
  ASSESSMENT_COMPLETED = 'assessment_completed',
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
  assessments_shared_count: number;

  @ApiProperty({ example: 0 })
  shortlisted_candidates: number;

  @ApiProperty({ example: 0 })
  my_roles: number;
}

export class EmployerDashboardRecentRoleDto {
  @ApiProperty({ format: 'uuid' })
  role_id: string;

  @ApiProperty({ example: 'Senior Frontend Engineer' })
  role_title: string;

  @ApiProperty({ example: 'Engineering' })
  category: string;

  @ApiProperty({ example: true })
  assessment_attached: boolean;

  @ApiProperty({ example: 3 })
  offers_sent: number;

  @ApiProperty({ enum: ['active', 'closed'], example: 'active' })
  status: string;
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

  @ApiProperty({ nullable: true, example: '/employer/roles/uuid' })
  link: string | null;
}

export class EmployerDashboardHomeResponseDto {
  @ApiProperty({ example: 'Lisan Al Gaib' })
  company_name: string;

  @ApiProperty({
    enum: EmployerDashboardViewState,
    example: EmployerDashboardViewState.NEW_USER,
  })
  view_state: EmployerDashboardViewState;

  @ApiProperty({ example: false })
  new_user_state: boolean;

  @ApiProperty({ type: EmployerDashboardProfilePromptDto })
  profile_prompt: EmployerDashboardProfilePromptDto;

  @ApiProperty({ type: EmployerDashboardOverviewCountsDto, nullable: true })
  overview_counts: EmployerDashboardOverviewCountsDto | null;

  @ApiProperty({ type: [EmployerDashboardRecentRoleDto], nullable: true })
  recent_roles: EmployerDashboardRecentRoleDto[] | null;

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
  assessments_shared_count: number;
  shortlisted_candidates: number;
  my_roles: number;
};

export type EmployerDashboardRecentRole = {
  role_id: string;
  role_title: string;
  category: string;
  assessment_attached: boolean;
  offers_sent: number;
  status: string;
};

export type EmployerDashboardActivity = {
  id: string;
  type: EmployerDashboardActivityType;
  title: string;
  description: string;
  occurred_at: string;
  link: string | null;
};

export type EmployerDashboardHomeResponse = {
  company_name: string;
  view_state: EmployerDashboardViewState;
  new_user_state: boolean;
  profile_prompt: EmployerDashboardProfilePrompt;
  overview_counts: EmployerDashboardOverviewCounts | null;
  recent_roles: EmployerDashboardRecentRole[] | null;
  recent_activity: EmployerDashboardActivity[];
};
