import { EmployerProfile } from '../employer/entities/employer-profile.entity';

export type EmployerDashboardProfileCompletenessRule = {
  key: string;
  label: string;
  weight: number;
  isFilled: (profile: EmployerProfile | null, isVerified: boolean) => boolean;
};

function hasAnyText(...values: Array<string | null | undefined>): boolean {
  return values.some((value) => Boolean(value?.trim()));
}

function hasAnyValues(values: string[] | null | undefined): boolean {
  return Array.isArray(values) && values.length > 0;
}

export const EMPLOYER_DASHBOARD_COPY = {
  subheader: 'Browse top Job Ready talents for your next hire.',
  profilePrompt: {
    title: 'Complete your profile',
    description:
      'Finish your employer profile and verification details to unlock offers and assessment sharing.',
    ctaLabel: 'Complete profile',
    ctaRoute: '/employer/profile',
  },
  createRoleCta: {
    label: 'Create a role',
    route: '/e/roles/new',
    variant: 'primary',
  },
  browseTalentsCta: {
    label: 'Explore verified talent',
    route: '/e/dashboard',
    variant: 'primary',
  },
  rolesCta: {
    label: 'View roles',
    route: '/e/roles',
    variant: 'secondary',
  },
  overviewCards: {
    verifiedTalentDescription:
      'Browse top Job Ready candidates already verified across multiple role tracks.',
    assessmentsDescription:
      'Review and manage the assessments you have created for your hiring workflows.',
    shortlistDescription:
      'Review saved candidates and move the strongest matches forward faster.',
    rolesDescription:
      'Manage the roles you have created and keep offer workflows tied to open positions.',
  },
  newUserHero: {
    title: 'Start discovering verified talent.',
    description:
      'Browse top Job Ready talents, create roles, and move candidates through your hiring flow.',
  },
  capabilities: [
    {
      title: 'Discover verified talents',
      description:
        'Explore candidates who have already completed CredLane verification and assessments.',
    },
    {
      title: 'Create and share assessments',
      description:
        'Attach assessments to your hiring flow and keep candidate screening structured.',
    },
    {
      title: 'Manage your shortlist',
      description:
        'Save standout candidates and keep hiring decisions organized in one place.',
    },
  ],
  socialProof: {
    headline: 'Trusted by fast-moving teams hiring across Africa.',
    testimonials: [
      'CredLane helps us spend less time screening and more time interviewing strong candidates.',
      'The employer dashboard gives our team a clear hiring view without chasing updates manually.',
    ],
  },
  emptyStates: {
    roles:
      'No roles created yet. Create your first role to start sending offers.',
  },
} as const;

export const EMPLOYER_DASHBOARD_PROFILE_COMPLETENESS_RULES: ReadonlyArray<EmployerDashboardProfileCompletenessRule> =
  [
    {
      key: 'company_name',
      label: 'Add your company name',
      weight: 15,
      isFilled: (profile) => hasAnyText(profile?.company_name),
    },
    {
      key: 'company_size',
      label: 'Add your company size',
      weight: 10,
      isFilled: (profile) => hasAnyText(profile?.company_size),
    },
    {
      key: 'industry',
      label: 'Add your industry',
      weight: 10,
      isFilled: (profile) => hasAnyText(profile?.industry),
    },
    {
      key: 'region',
      label: 'Add your hiring region',
      weight: 10,
      isFilled: (profile) =>
        hasAnyText(profile?.region, profile?.hiring_region),
    },
    {
      key: 'company_website',
      label: 'Add your company website',
      weight: 15,
      isFilled: (profile) =>
        hasAnyText(profile?.company_website, profile?.website_url),
    },
    {
      key: 'linkedin',
      label: 'Add your company LinkedIn page',
      weight: 15,
      isFilled: (profile) =>
        hasAnyText(
          profile?.linkedin_company_page_url,
          profile?.linkedin_company_url,
        ),
    },
    {
      key: 'hiring_roles',
      label: 'Select the roles you are hiring for',
      weight: 15,
      isFilled: (profile) =>
        hasAnyValues(profile?.hiring_roles) ||
        hasAnyValues(profile?.desired_roles),
    },
    {
      key: 'preferred_experience_levels',
      label: 'Choose preferred experience levels',
      weight: 5,
      isFilled: (profile) => hasAnyValues(profile?.preferred_experience_levels),
    },
    {
      key: 'verification',
      label: 'Complete employer verification',
      weight: 5,
      isFilled: (_profile, isVerified) => isVerified,
    },
  ] as const;
