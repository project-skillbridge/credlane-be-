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
] as const;

export type TalentRoleTrack = (typeof TALENT_ROLE_TRACKS)[number];



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


export const SKILL_ASSESSMENT_LEVEL_THRESHOLDS: Array<{
  level: VerifiedLevel;
  min: number;
}> = [
  { level: VerifiedLevel.EXPERT, min: 90 },
  { level: VerifiedLevel.SENIOR, min: 75 },
  { level: VerifiedLevel.MID,    min: 60 },
  { level: VerifiedLevel.JUNIOR, min: 40 },
  { level: VerifiedLevel.ENTRY,  min: 0  },
];