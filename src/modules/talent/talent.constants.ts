import { VerifiedLevel } from '../assessments/entities/assessment-question.entity';

export const TALENT_GOALS = [
  'land_first_role',
  'build_technical_skills',
  'validate_current_ability',
  'become_more_employable',
] as const;

export type TalentGoal = (typeof TALENT_GOALS)[number];

export const TALENT_ROLE_TRACKS = [
  'product_designer',
  'frontend_developer',
  'data_analyst',
  'cloud_devops',
  'product_manager',
  'backend_developer',
  'mobile_developer',
  'cybersecurity',
  'data_scientist',
  'marketing',
  'quality_assurance',
  'fullstack_developer',
  'data_engineer',
  'ml_engineer',
  'business_analyst',
  'bi_developer',
  'ux_researcher',
  'brand_designer',
  'customer_success',
  'project_manager',
  'operations_manager',
  'hr_people_ops',
] as const;

export type TalentRoleTrack = (typeof TALENT_ROLE_TRACKS)[number];

/** Same values as `verified_level_enum` / `ValidatedLevel` on the profile. */
export const TALENT_CLAIMED_LEVELS = [
  VerifiedLevel.JUNIOR,
  VerifiedLevel.MID,
  VerifiedLevel.SENIOR,
  VerifiedLevel.EXPERT,
] as const;

export type TalentClaimedLevel = VerifiedLevel;

export const TALENT_EDUCATION_LEVELS = [
  'high_school',
  'associate',
  'bachelor',
  'master',
  'doctorate',
  'bootcamp',
  'other',
] as const;

export type TalentEducationLevel = (typeof TALENT_EDUCATION_LEVELS)[number];

/** Maximum completed skill assessment attempts before advanced assessment is done. */
export const SKILL_ASSESSMENT_MAX_ATTEMPTS = 3;

/** How long (ms) before an incomplete skill session is considered abandoned. */
export const SKILL_ASSESSMENT_SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Minimum claimed-level score (Stage 2) required to confirm level and unlock Stage 3. */
export const SKILL_ASSESSMENT_PASS_PERCENTAGE = 70;
