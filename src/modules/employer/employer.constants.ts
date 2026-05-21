/** Legacy onboarding field values (lowercase). */
export const EMPLOYER_JOINING_AS = ['recruiter', 'founder', 'agency'] as const;

export type EmployerJoiningAs = (typeof EMPLOYER_JOINING_AS)[number];

export const EMPLOYER_HIRING_RANGES = [
  '1_5',
  '6_10',
  '11_25',
  '26_50',
  '51_plus',
] as const;

export type EmployerHiringRange = (typeof EMPLOYER_HIRING_RANGES)[number];

/** Same role tracks the talent side uses — employers search for these. */
export const EMPLOYER_DESIRED_ROLES = [
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

export type EmployerDesiredRole = (typeof EMPLOYER_DESIRED_ROLES)[number];

/** New employer profile onboarding (FE-ONB-EMP-001 / BE-ONB-EMP-001). */
export const EMPLOYER_TYPES = ['Founder', 'Recruiter', 'Agency'] as const;

export const EMPLOYER_COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '500+',
] as const;

export const EMPLOYER_HIRING_LOCATIONS = [
  'Nigeria',
  'Africa',
  'Remote Worldwide',
  'UK',
  'Europe',
  'North America',
] as const;
