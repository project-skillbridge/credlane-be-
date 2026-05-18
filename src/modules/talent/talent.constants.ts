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
] as const;

export type TalentRoleTrack = (typeof TALENT_ROLE_TRACKS)[number];

import { VerifiedLevel } from '../assessments/entities/assessment-question.entity';

/** Same values as `verified_level_enum` / `ValidatedLevel` on the profile. */
export const TALENT_CLAIMED_LEVELS = [
  VerifiedLevel.ENTRY,
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