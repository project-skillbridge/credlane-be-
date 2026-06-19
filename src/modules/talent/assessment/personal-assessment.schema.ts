export type PersonalAssessmentInputType =
  | 'single'
  | 'multi'
  | 'text_required'
  | 'text_optional';

export type PersonalAssessmentQuestionOption = {
  value: string;
  label: string;
};

export type PersonalAssessmentQuestion = {
  key: string;
  questionNumber: number;
  inputType: PersonalAssessmentInputType;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  options?: readonly string[];
  otherTextKey?: string;
  followUpKey?: string;
  followUpWhen?: string;
  skipStorage?: boolean;
  profileField?:
    | 'track'
    | 'education_level'
    | 'region'
    | 'linkedin_url'
    | 'claimed_level'
    | 'country';
  /** Stable content id, e.g. PA-GEN-INT-001 */
  externalId?: string;
  /** Section slug from the database row */
  sectionSlug?: string;
  /** Full candidate-facing question text */
  prompt?: string;
  /** Track scope: "all" or a specific onboarding track slug */
  track?: string;
  /** Labelled options preserved for API enrichment */
  optionItems?: readonly PersonalAssessmentQuestionOption[];
};

/** Maps section slugs to legacy numeric section ids used in session responses. */
export const PERSONAL_ASSESSMENT_SECTION_SLUG_TO_NUMBER: Record<
  string,
  number
> = {
  professional_background: 1,
  skills_and_expertise: 2,
  leadership_and_responsibility: 3,
  international_and_remote_experience: 4,
  work_style: 5,
};

export const PERSONAL_ASSESSMENT_SECTION_NUMBER_TO_SLUG: Record<
  number,
  string
> = {
  1: 'professional_background',
  2: 'skills_and_expertise',
  3: 'leadership_and_responsibility',
  4: 'international_and_remote_experience',
  5: 'work_style',
};

export const PERSONAL_ASSESSMENT_SECTION_COUNT = 5;

export const PERSONAL_ASSESSMENT_SECTION_TITLES: Record<number, string> = {
  1: 'Professional Background',
  2: 'Skills & Expertise',
  3: 'Leadership & Responsibility',
  4: 'International & Remote Experience',
  5: 'Work Style',
};

/** Ignored in section POST bodies — sourced from onboarding / user profile. */
export const SKIPPED_ONBOARDING_ANSWER_KEYS = new Set([
  'education_level',
  'educationLevel',
  'country',
  'region',
  'skill_track',
  'track',
  'portfolio_url',
  'linkedinProfile',
  'linkedin_url',
]);

export const YEARS_EXPERIENCE = [
  '0_1_yr',
  '1_3_yrs',
  '3_5_yrs',
  '5_10_yrs',
  '10_plus_yrs',
] as const;

export const INDUSTRIES = [
  'fintech',
  'healthcare',
  'ecommerce',
  'government',
  'ngo',
  'media_entertainment',
  'education',
  'logistics',
  'telecoms',
  'oil_gas',
  'agriculture',
  'other',
] as const;

export const LARGEST_ORG_SIZE = [
  'solo_freelance',
  '2_10',
  '11_50',
  '51_200',
  '201_1000',
  '1000_plus',
] as const;

export const ORG_TYPES = [
  'startup_under_50',
  'mid_size',
  'large_corporation',
  'government',
  'freelance',
  'self_employed',
] as const;

export const STUDENT_STATUS = ['no', 'yes_part_time', 'yes_full_time'] as const;

export const PRIMARY_LANGUAGE = [
  'english',
  'french',
  'arabic',
  'portuguese',
  'swahili',
  'other',
] as const;

export const PRIMARY_TOOL_DURATION = [
  'less_than_6_months',
  '6_12_months',
  '1_2_years',
  '3_5_years',
  '5_plus_years',
] as const;

export const MENTORING_EXPERIENCE = [
  'yes_formally',
  'yes_informally',
  'no',
] as const;

export const SHIPPED_DELIVERABLE = [
  'yes_multiple',
  'yes_once',
  'not_yet',
] as const;

export const MANAGED_TEAM = [
  'no',
  'yes_1_to_3',
  'yes_4_to_10',
  'yes_10_plus',
] as const;

export const LEADERSHIP_TITLES = [
  'team_lead',
  'manager',
  'senior_manager',
  'head_of_department',
  'director',
  'vp_c_suite',
  'none',
] as const;

export const LED_PROJECT_UNSUPERVISED = [
  'yes_multiple',
  'yes_once',
  'no',
] as const;

export const YES_NO = ['yes', 'no'] as const;

export const BUDGET_RESPONSIBILITY = [
  'yes_regularly',
  'yes_once_or_twice',
  'no',
] as const;

export const INTERNATIONAL_ORG_EXPERIENCE = [
  'yes_extensively',
  'yes_occasionally',
  'no',
] as const;

export const REMOTE_EXPERIENCE = [
  'yes_2_plus_years',
  'yes_less_than_2_years',
  'no',
] as const;

export const TIME_ZONES_COLLABORATED = [
  'same_time_zone',
  '1_2_time_zones',
  '3_5_time_zones',
  '6_plus_time_zones',
] as const;

export const INTERNATIONAL_STAKEHOLDERS = [
  'yes_regularly',
  'yes_occasionally',
  'no',
] as const;

export const WORK_ARRANGEMENT_PREFERENCE = [
  'fully_remote',
  'hybrid',
  'in_person_only',
  'flexible',
  'open_to_any',
] as const;

export const REMOTE_WORKSPACE_SETUP = [
  'yes_fully_set_up',
  'yes_mostly',
  'working_on_it',
  'no',
] as const;

export const FEEDBACK_PREFERENCE = [
  'directly_bluntly',
  'bluntly_with_context',
  'gently_with_examples',
  'no_preference',
] as const;

export const ONBOARDING_TRACK_TO_ASSESSMENT_TRACK: Record<string, string> = {
  backend_developer: 'backend_engineering',
  bi_developer: 'data_analytics',
  brand_designer: 'design_ui_ux',
  business_analyst: 'data_analytics',
  cloud_devops: 'devops_cloud',
  cybersecurity: 'devops_cloud',
  customer_success: 'customer_support',
  data_analyst: 'data_analytics',
  data_engineer: 'data_analytics',
  data_scientist: 'data_analytics',
  frontend_developer: 'frontend_engineering',
  fullstack_developer: 'frontend_engineering',
  hr_people_ops: 'hr_people_ops',
  marketing: 'marketing',
  ml_engineer: 'data_analytics',
  mobile_developer: 'mobile_engineering',
  operations_manager: 'customer_support',
  product_designer: 'design_ui_ux',
  product_manager: 'product_management',
  project_manager: 'product_management',
  quality_assurance: 'other',
  ux_researcher: 'design_ui_ux',
};

export const SPECIALIZATIONS_BY_TRACK: Record<string, readonly string[]> = {
  backend_engineering: [
    'api_design',
    'microservices',
    'databases',
    'distributed_systems',
    'cloud_native',
    'other',
  ],
  frontend_engineering: [
    'web_apps',
    'component_libraries',
    'accessibility',
    'performance',
    'animations',
    'other',
  ],
  mobile_engineering: [
    'ios',
    'android',
    'cross_platform',
    'react_native',
    'flutter',
    'other',
  ],
  data_analytics: [
    'data_analyst',
    'business_intelligence',
    'data_engineering',
    'machine_learning',
    'other',
  ],
  product_management: ['technical_pm', 'growth_pm', 'platform_pm', 'other'],
  design_ui_ux: ['ui_design', 'ux_research', 'product_design', 'other'],
  marketing: [
    'digital_marketing',
    'content_marketing',
    'growth_marketing',
    'brand',
    'other',
  ],
  sales: ['b2b', 'b2c', 'enterprise', 'sdr_bdr', 'other'],
  customer_support: [
    'technical_support',
    'customer_success',
    'operations',
    'other',
  ],
  finance_accounting: ['accounting', 'financial_analysis', 'fp_a', 'other'],
  hr_people_ops: ['recruiting', 'hr_generalist', 'people_ops', 'other'],
  content_copywriting: [
    'copywriting',
    'technical_writing',
    'content_strategy',
    'other',
  ],
  devops_cloud: ['devops', 'sre', 'cloud_engineering', 'security', 'other'],
  other: ['general', 'other'],
};

export const TOOLS_BY_TRACK: Record<string, readonly string[]> = {
  backend_engineering: [
    'git',
    'docker',
    'postgresql',
    'redis',
    'aws',
    'node',
    'python',
    'go',
    'other',
  ],
  frontend_engineering: [
    'git',
    'react',
    'vue',
    'typescript',
    'webpack',
    'figma',
    'vscode',
    'other',
  ],
  mobile_engineering: [
    'git',
    'xcode',
    'android_studio',
    'react_native',
    'flutter',
    'firebase',
    'other',
  ],
  data_analytics: [
    'sql',
    'excel',
    'python',
    'tableau',
    'power_bi',
    'dbt',
    'other',
  ],
  product_management: [
    'jira',
    'figma',
    'notion',
    'amplitude',
    'mixpanel',
    'other',
  ],
  design_ui_ux: ['figma', 'sketch', 'adobe_xd', 'miro', 'other'],
  marketing: ['google_analytics', 'hubspot', 'mailchimp', 'meta_ads', 'other'],
  sales: ['salesforce', 'hubspot', 'pipedrive', 'linkedin_sales', 'other'],
  customer_support: ['zendesk', 'intercom', 'freshdesk', 'other'],
  finance_accounting: ['excel', 'quickbooks', 'xero', 'sap', 'other'],
  hr_people_ops: ['workday', 'bamboohr', 'greenhouse', 'other'],
  content_copywriting: ['google_docs', 'notion', 'wordpress', 'other'],
  devops_cloud: [
    'docker',
    'kubernetes',
    'terraform',
    'aws',
    'gcp',
    'azure',
    'other',
  ],
  other: ['other'],
};
