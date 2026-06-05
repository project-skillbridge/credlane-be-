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

export const EMPLOYER_PREFERRED_EXPERIENCE_LEVELS = [
  'junior',
  'mid',
  'senior',
] as const;

/** Shared LinkedIn company page URL validation. */
export const LINKEDIN_COMPANY_URL_REGEX = new RegExp(
  /^https?:\/\/(www\.)?linkedin\.com\/company\/[A-Za-z0-9\-_]+(?:\/)?(?:[/?#].*)?$/
    .source,
  'i',
);

export const LINKEDIN_COMPANY_PAGE_ERROR =
  'linkedin_company_page_url must be a valid LinkedIn company page URL';

/** Days before restricted employer identity fields can be edited again. */
export const PROFILE_COOLDOWN_DAYS = 180;
