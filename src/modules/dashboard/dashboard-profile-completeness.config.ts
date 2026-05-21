import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { User } from '../users/entities/user.entity';

export type DashboardProfileCompletenessContext = {
  user: User;
  profile: TalentProfile;
};

export type DashboardProfileCompletenessRule = {
  key: string;
  weight: number;
  isFilled: (context: DashboardProfileCompletenessContext) => boolean;
};

function hasAnyText(...values: Array<string | null | undefined>): boolean {
  return values.some((value) => Boolean(value?.trim()));
}

export const DASHBOARD_PROFILE_COMPLETENESS_CONFIG = {
  onboardingStepScores: [0, 20, 40, 60],
  rules: [
    {
      key: 'avatar',
      weight: 8,
      isFilled: ({ user }) => Boolean(user.avatar_url),
    },
    {
      key: 'career_direction',
      weight: 8,
      isFilled: ({ profile }) =>
        hasAnyText(
          profile.goal,
          profile.track,
          profile.role_track,
          ...(profile.role_tracks ?? []),
        ),
    },
    {
      key: 'region',
      weight: 8,
      isFilled: ({ profile }) => Boolean(profile.region?.trim()),
    },
    {
      key: 'education_level',
      weight: 8,
      isFilled: ({ profile }) => Boolean(profile.education_level?.trim()),
    },
    {
      key: 'bio_or_linkedin',
      weight: 8,
      isFilled: ({ profile }) =>
        Boolean(profile.linkedin_url?.trim() || profile.bio?.trim()),
    },
  ] as const,
} as const satisfies {
  onboardingStepScores: readonly number[];
  rules: readonly DashboardProfileCompletenessRule[];
};
