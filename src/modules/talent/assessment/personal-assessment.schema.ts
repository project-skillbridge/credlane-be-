export type PersonalAssessmentInputType =
  | 'single'
  | 'multi'
  | 'text_required'
  | 'text_optional';

export type PersonalAssessmentQuestion = {
  key: string;
  questionNumber: number;
  inputType: PersonalAssessmentInputType;
  required: boolean;
  minLength?: number;
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
};

export const PERSONAL_ASSESSMENT_SECTION_COUNT = 7;

export const PERSONAL_ASSESSMENT_SECTION_TITLES: Record<number, string> = {
  1: 'Professional Background',
  2: 'Skills & Expertise',
  3: 'Leadership & Responsibility',
  4: 'International & Remote Experience',
  5: 'Work Style',
  6: 'Achievements & Proof',
  7: 'Availability & Intent',
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

export const PROFESSIONAL_RECOGNITION = ['yes', 'no'] as const;

export const JOB_SEARCH_STATUS = [
  'actively_looking',
  'open_to_right_opportunity',
  'just_exploring',
] as const;

export const AVAILABILITY = [
  'immediately_available',
  'on_notice_under_1_month',
  'on_notice_1_3_months',
  'employed_flexible',
] as const;

export const ENGAGEMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'freelance',
  'open_to_all',
] as const;

export const COMPENSATION_EXPECTATION = [
  'no_preference',
  'below_market',
  'market_rate',
  'above_market',
] as const;

export const COMPENSATION_CURRENCY = [
  'ngn',
  'usd',
  'gbp',
  'kes',
  'ghs',
  'zar',
  'eur',
  'other',
] as const;

export const ONBOARDING_TRACK_TO_ASSESSMENT_TRACK: Record<string, string> = {
  product_designer: 'design_ui_ux',
  frontend_developer: 'frontend_engineering',
  data_analyst: 'data_analytics',
  cloud_devops: 'devops_cloud',
  product_manager: 'product_management',
  backend_developer: 'backend_engineering',
  mobile_developer: 'mobile_engineering',
  cybersecurity: 'devops_cloud',
  data_scientist: 'data_analytics',
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

export const PERSONAL_ASSESSMENT_SECTIONS: Record<
  number,
  PersonalAssessmentQuestion[]
> = {
  1: [
    {
      key: 'job_title',
      questionNumber: 1,
      inputType: 'text_required',
      required: true,
      minLength: 2,
    },
    {
      key: 'years_experience',
      questionNumber: 2,
      inputType: 'single',
      required: true,
      options: YEARS_EXPERIENCE,
    },
    {
      key: 'industries',
      questionNumber: 3,
      inputType: 'multi',
      required: true,
      options: INDUSTRIES,
      otherTextKey: 'industries_other',
    },
    {
      key: 'largest_org_size',
      questionNumber: 4,
      inputType: 'single',
      required: true,
      options: LARGEST_ORG_SIZE,
    },
    {
      key: 'org_types',
      questionNumber: 5,
      inputType: 'multi',
      required: true,
      options: ORG_TYPES,
    },
    {
      key: 'education_level',
      questionNumber: 6,
      inputType: 'single',
      required: true,
      skipStorage: true,
      profileField: 'education_level',
    },
    {
      key: 'student_status',
      questionNumber: 7,
      inputType: 'single',
      required: true,
      options: STUDENT_STATUS,
    },
    {
      key: 'country',
      questionNumber: 8,
      inputType: 'text_required',
      required: true,
      minLength: 2,
      skipStorage: true,
      profileField: 'country',
    },
    {
      key: 'region',
      questionNumber: 9,
      inputType: 'text_required',
      required: true,
      minLength: 2,
      skipStorage: true,
      profileField: 'region',
    },
    {
      key: 'primary_language',
      questionNumber: 10,
      inputType: 'single',
      required: true,
      options: PRIMARY_LANGUAGE,
      otherTextKey: 'primary_language_other',
    },
  ],
  2: [
    {
      key: 'skill_track',
      questionNumber: 11,
      inputType: 'single',
      required: true,
      skipStorage: true,
      profileField: 'track',
    },
    {
      key: 'specialization',
      questionNumber: 12,
      inputType: 'single',
      required: true,
      // Options from SPECIALIZATIONS_BY_TRACK at runtime (validated in personal-assessment.validation).
    },
    {
      key: 'claimed_level',
      questionNumber: 13,
      inputType: 'single',
      required: true,
    },
    {
      key: 'tools',
      questionNumber: 14,
      inputType: 'multi',
      required: false,
      otherTextKey: 'tools_other',
      // Options from TOOLS_BY_TRACK at runtime (validated in personal-assessment.validation).
    },
    {
      key: 'primary_tool_duration',
      questionNumber: 15,
      inputType: 'single',
      required: true,
      options: PRIMARY_TOOL_DURATION,
    },
    {
      key: 'mentoring_experience',
      questionNumber: 16,
      inputType: 'single',
      required: true,
      options: MENTORING_EXPERIENCE,
    },
    {
      key: 'shipped_deliverable',
      questionNumber: 17,
      inputType: 'single',
      required: true,
      options: SHIPPED_DELIVERABLE,
    },
    // skipStorage: ignored on section POST; profileField supplies linkedin_url for context/complete.
    {
      key: 'portfolio_url',
      questionNumber: 18,
      inputType: 'text_optional',
      required: false,
      skipStorage: true,
      profileField: 'linkedin_url',
    },
  ],
  3: [
    {
      key: 'managed_team',
      questionNumber: 19,
      inputType: 'single',
      required: true,
      options: MANAGED_TEAM,
    },
    {
      key: 'leadership_titles',
      questionNumber: 20,
      inputType: 'multi',
      required: true,
      options: LEADERSHIP_TITLES,
    },
    {
      key: 'difficult_decision_narrative',
      questionNumber: 21,
      inputType: 'text_required',
      required: true,
      minLength: 80,
    },
    {
      key: 'led_project_unsupervised',
      questionNumber: 22,
      inputType: 'single',
      required: true,
      options: LED_PROJECT_UNSUPERVISED,
    },
    {
      key: 'hiring_experience',
      questionNumber: 23,
      inputType: 'single',
      required: true,
      options: YES_NO,
    },
    {
      key: 'budget_responsibility',
      questionNumber: 24,
      inputType: 'single',
      required: true,
      options: BUDGET_RESPONSIBILITY,
    },
  ],
  4: [
    {
      key: 'international_org_experience',
      questionNumber: 25,
      inputType: 'single',
      required: true,
      options: INTERNATIONAL_ORG_EXPERIENCE,
    },
    {
      key: 'remote_experience',
      questionNumber: 26,
      inputType: 'single',
      required: true,
      options: REMOTE_EXPERIENCE,
    },
    {
      key: 'time_zones_collaborated',
      questionNumber: 27,
      inputType: 'single',
      required: true,
      options: TIME_ZONES_COLLABORATED,
    },
    {
      key: 'international_stakeholders',
      questionNumber: 28,
      inputType: 'single',
      required: true,
      options: INTERNATIONAL_STAKEHOLDERS,
    },
    {
      key: 'work_arrangement_preference',
      questionNumber: 29,
      inputType: 'multi',
      required: true,
      options: WORK_ARRANGEMENT_PREFERENCE,
    },
    {
      key: 'remote_workspace_setup',
      questionNumber: 30,
      inputType: 'single',
      required: true,
      options: REMOTE_WORKSPACE_SETUP,
    },
  ],
  5: [
    {
      key: 'deadline_handling',
      questionNumber: 31,
      inputType: 'text_required',
      required: true,
      minLength: 60,
    },
    {
      key: 'ideal_work_environment',
      questionNumber: 32,
      inputType: 'text_required',
      required: true,
      minLength: 60,
    },
    {
      key: 'feedback_preference',
      questionNumber: 33,
      inputType: 'single',
      required: true,
      options: FEEDBACK_PREFERENCE,
    },
    {
      key: 'professional_disagreement',
      questionNumber: 34,
      inputType: 'text_optional',
      required: false,
      minLength: 60,
    },
    {
      key: 'workload_management',
      questionNumber: 35,
      inputType: 'text_required',
      required: true,
      minLength: 60,
    },
    {
      key: 'quick_learning_narrative',
      questionNumber: 36,
      inputType: 'text_required',
      required: true,
      minLength: 60,
    },
  ],
  6: [
    {
      key: 'proudest_achievement',
      questionNumber: 37,
      inputType: 'text_required',
      required: true,
      minLength: 100,
    },
    {
      key: 'measurable_impact',
      questionNumber: 38,
      inputType: 'text_optional',
      required: false,
    },
    {
      key: 'professional_recognition',
      questionNumber: 39,
      inputType: 'single',
      required: true,
      options: PROFESSIONAL_RECOGNITION,
      followUpKey: 'professional_recognition_details',
      followUpWhen: 'yes',
    },
    {
      key: 'public_work_links',
      questionNumber: 40,
      inputType: 'text_optional',
      required: false,
    },
    {
      key: 'background_context',
      questionNumber: 41,
      inputType: 'text_optional',
      required: false,
    },
  ],
  7: [
    {
      key: 'job_search_status',
      questionNumber: 42,
      inputType: 'single',
      required: true,
      options: JOB_SEARCH_STATUS,
    },
    {
      key: 'availability',
      questionNumber: 43,
      inputType: 'single',
      required: true,
      options: AVAILABILITY,
    },
    {
      key: 'engagement_types',
      questionNumber: 44,
      inputType: 'multi',
      required: true,
      options: ENGAGEMENT_TYPES,
    },
    {
      key: 'preferred_work_location',
      questionNumber: 45,
      inputType: 'text_required',
      required: true,
      minLength: 2,
    },
    {
      key: 'compensation_expectation',
      questionNumber: 46,
      inputType: 'single',
      required: true,
      options: COMPENSATION_EXPECTATION,
    },
    {
      key: 'compensation_currency',
      questionNumber: 47,
      inputType: 'single',
      required: true,
      options: COMPENSATION_CURRENCY,
    },
    {
      key: 'next_role_narrative',
      questionNumber: 48,
      inputType: 'text_required',
      required: true,
      minLength: 80,
    },
  ],
};

export function getSectionQuestions(
  section: number,
): PersonalAssessmentQuestion[] {
  return PERSONAL_ASSESSMENT_SECTIONS[section] ?? [];
}

export function getAllPersonalAssessmentQuestions(): PersonalAssessmentQuestion[] {
  const questions: PersonalAssessmentQuestion[] = [];
  for (
    let section = 1;
    section <= PERSONAL_ASSESSMENT_SECTION_COUNT;
    section++
  ) {
    questions.push(...getSectionQuestions(section));
  }
  return questions;
}

/** Question keys filled from onboarding / user profile — not collected via section POST. */
export function getOnboardingBackedQuestionKeys(): readonly string[] {
  return getAllPersonalAssessmentQuestions()
    .filter((question) => question.skipStorage)
    .map((question) => question.key);
}
