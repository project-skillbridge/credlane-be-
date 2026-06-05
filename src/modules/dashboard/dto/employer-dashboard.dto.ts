import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum EmployerDashboardViewState {
  NEW_USER = 'new_user',
  EXISTING_USER = 'existing_user',
}

export enum EmployerDashboardActivityType {
  VERIFIED_TALENT = 'verified_talent',
  SHORTLIST = 'shortlist',
  OFFER_ACCEPTED = 'offer_accepted',
}

export class EmployerDashboardCallToActionDto {
  @ApiProperty({ example: 'Explore verified talent' })
  label: string;

  @ApiProperty({ example: '/discovery' })
  route: string;

  @ApiProperty({ example: 'primary' })
  variant: string;
}

export class EmployerDashboardProfilePromptDto {
  @ApiProperty({ example: true })
  show_prompt: boolean;

  @ApiProperty({ example: false })
  is_verified: boolean;

  @ApiProperty({ example: 72, minimum: 0, maximum: 100 })
  completion_percentage: number;

  @ApiProperty({ example: 'Complete your profile' })
  title: string;

  @ApiProperty({
    example:
      'Finish your employer profile and verification details to unlock offers and assessment sharing.',
  })
  description: string;

  @ApiProperty({ example: 'Complete profile' })
  cta_label: string;

  @ApiProperty({ example: '/employer/profile' })
  cta_route: string;

  @ApiProperty({ type: [String] })
  missing_items: string[];
}

export class EmployerDashboardHeroDto {
  @ApiProperty({ example: 'Start discovering verified talent.' })
  title: string;

  @ApiProperty({
    example:
      'Browse top Job Ready talents, create roles, and move candidates through your hiring flow.',
  })
  description: string;

  @ApiProperty({ type: [EmployerDashboardCallToActionDto] })
  actions: EmployerDashboardCallToActionDto[];
}

export class EmployerDashboardCapabilityDto {
  @ApiProperty({ example: 'Discover verified talents' })
  title: string;

  @ApiProperty({
    example:
      'Explore candidates who have already completed CredLane verification and assessments.',
  })
  description: string;
}

export class EmployerDashboardSocialProofDto {
  @ApiProperty({ example: 'Trusted by fast-moving teams hiring across Africa.' })
  headline: string;

  @ApiProperty({ type: [String] })
  testimonials: string[];
}

export class EmployerDashboardStatCardDto {
  @ApiProperty({ example: 'verified_talent' })
  key: string;

  @ApiProperty({ example: 'Verified Talent' })
  title: string;

  @ApiProperty({ example: 12 })
  value: number;

  @ApiProperty({
    example:
      'Browse top Job Ready candidates already verified across multiple role tracks.',
  })
  description: string;

  @ApiProperty({ example: 'Browse talents' })
  cta_label: string;

  @ApiProperty({ example: '/discovery' })
  cta_route: string;
}

export class EmployerDashboardActivityDto {
  @ApiProperty({
    enum: EmployerDashboardActivityType,
    example: EmployerDashboardActivityType.SHORTLIST,
  })
  type: EmployerDashboardActivityType;

  @ApiProperty({ example: 'You shortlisted Jane Doe' })
  title: string;

  @ApiProperty({
    example: 'Your shortlist now includes another verified frontend developer.',
  })
  description: string;

  @ApiProperty({ format: 'date-time' })
  occurred_at: string;

  @ApiProperty({ example: '/shortlist' })
  route: string;
}

export class EmployerDashboardHomeResponseDto {
  @ApiProperty({ example: 'Acme Labs' })
  company_name: string;

  @ApiProperty({
    enum: EmployerDashboardViewState,
    example: EmployerDashboardViewState.EXISTING_USER,
  })
  view_state: EmployerDashboardViewState;

  @ApiProperty({ example: 'Welcome back, Acme Labs.' })
  header: string;

  @ApiProperty({
    example: 'Browse top Job Ready talents for your next hire.',
  })
  subheader: string;

  @ApiProperty({ type: EmployerDashboardProfilePromptDto })
  profile_prompt: EmployerDashboardProfilePromptDto;

  @ApiProperty({ type: EmployerDashboardCallToActionDto })
  create_role_cta: EmployerDashboardCallToActionDto;

  @ApiProperty({ type: [EmployerDashboardStatCardDto] })
  overview_cards: EmployerDashboardStatCardDto[];

  @ApiProperty({ type: [EmployerDashboardActivityDto] })
  recent_activity: EmployerDashboardActivityDto[];

  @ApiPropertyOptional({ type: EmployerDashboardHeroDto, nullable: true })
  hero: EmployerDashboardHeroDto | null;

  @ApiProperty({ type: [EmployerDashboardCapabilityDto] })
  capabilities: EmployerDashboardCapabilityDto[];

  @ApiPropertyOptional({
    type: EmployerDashboardSocialProofDto,
    nullable: true,
  })
  social_proof: EmployerDashboardSocialProofDto | null;

  @ApiPropertyOptional({
    example: 'No roles created yet. Create your first role to start sending offers.',
    nullable: true,
  })
  roles_empty_state_message: string | null;
}

export type EmployerDashboardCallToAction = {
  label: string;
  route: string;
  variant: string;
};

export type EmployerDashboardProfilePrompt = {
  show_prompt: boolean;
  is_verified: boolean;
  completion_percentage: number;
  title: string;
  description: string;
  cta_label: string;
  cta_route: string;
  missing_items: string[];
};

export type EmployerDashboardHero = {
  title: string;
  description: string;
  actions: EmployerDashboardCallToAction[];
};

export type EmployerDashboardCapability = {
  title: string;
  description: string;
};

export type EmployerDashboardSocialProof = {
  headline: string;
  testimonials: string[];
};

export type EmployerDashboardStatCard = {
  key: string;
  title: string;
  value: number;
  description: string;
  cta_label: string;
  cta_route: string;
};

export type EmployerDashboardActivity = {
  type: EmployerDashboardActivityType;
  title: string;
  description: string;
  occurred_at: string;
  route: string;
};

export type EmployerDashboardHomeResponse = {
  company_name: string;
  view_state: EmployerDashboardViewState;
  header: string;
  subheader: string;
  profile_prompt: EmployerDashboardProfilePrompt;
  create_role_cta: EmployerDashboardCallToAction;
  overview_cards: EmployerDashboardStatCard[];
  recent_activity: EmployerDashboardActivity[];
  hero: EmployerDashboardHero | null;
  capabilities: EmployerDashboardCapability[];
  social_proof: EmployerDashboardSocialProof | null;
  roles_empty_state_message: string | null;
};
