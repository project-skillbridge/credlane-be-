import { OfferStatus } from '../offers/entities/offer.entity';
import { TALENT_SUPPORTED_ROLE_TRACKS } from '../talent/talent.constants';
import {
  compactStrings,
  formatSlugLabel,
  readPersonalAnswers,
  resolveAvailabilityLabel,
  resolveExperienceLabel,
  resolveJobSearchStatusLabel,
  resolveSeniorityBadge,
  resolveSkills,
  resolveTierLabel,
  resolveWorkArrangementLabels,
} from '../verified-profile/verified-profile.utils';

export type DiscoveryCandidateRawRow = {
  userId: string;
  roleTrack: string | null;
  tier: string;
  availability: string | null;
  verifiedAt: Date;
  score: number;
  strongCompetencies: string[] | null;
  shareToken: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  country: string | null;
  verifiedLevel: string | null;
  location: string | null;
  jobSearchStatus: string | null;
  specialization: string | null;
  personalAssessmentAnswers: Record<string, unknown> | null;
};

export type DiscoveryCandidateCard = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  role_track: string | null;
  seniority_badge: string | null;
  tier: string;
  score: number;
  skills: string[];
  about_tags: string[];
  availability: string | null;
  availability_label: string | null;
  verified_at: Date;
  strong_competencies: string[] | null;
  share_token: string | null;
  region: string | null;
  is_saved: boolean;
  offer_sent: boolean;
  offer_status: OfferStatus | null;
};

function resolveRoleTrackLabel(track: string | null): string {
  if (!track) {
    return 'Talent';
  }

  const entry = TALENT_SUPPORTED_ROLE_TRACKS.find(
    (item) => item.slug === track,
  );
  return entry?.label ?? formatSlugLabel(track);
}

function buildAboutTags(input: {
  personalAnswers: Record<string, unknown>;
  seniorityBadge: string | undefined;
  hasValidatedLevel: boolean;
  tierLabel: string | undefined;
  availability: string | null;
  jobSearchStatus: string | null;
}): string[] {
  const jobSearchStatus =
    input.jobSearchStatus ?? input.personalAnswers.job_search_status;

  return compactStrings([
    input.seniorityBadge,
    input.tierLabel,
    resolveJobSearchStatusLabel(jobSearchStatus),
    ...resolveWorkArrangementLabels(
      input.personalAnswers.work_arrangement_preference,
    ),
    input.hasValidatedLevel
      ? undefined
      : resolveExperienceLabel(input.personalAnswers.years_experience),
    jobSearchStatus !== 'not_looking'
      ? resolveAvailabilityLabel(
          input.availability ?? input.personalAnswers.availability,
        )
      : undefined,
  ]);
}

export function mapDiscoveryCandidateCard(
  row: DiscoveryCandidateRawRow,
  context: {
    is_saved: boolean;
    offer_sent: boolean;
    offer_status: OfferStatus | null;
  },
): DiscoveryCandidateCard {
  const personalAnswers = readPersonalAnswers(row.personalAssessmentAnswers);
  const hasValidatedLevel = Boolean(row.verifiedLevel);
  const seniorityBadge = resolveSeniorityBadge(row.verifiedLevel);
  const tierLabel = resolveTierLabel(row.tier);
  const skills = resolveSkills(personalAnswers) ?? [];

  return {
    user_id: row.userId,
    full_name: `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
    avatar_url: row.avatarUrl,
    role: resolveRoleTrackLabel(row.roleTrack),
    role_track: row.roleTrack,
    seniority_badge: seniorityBadge ?? null,
    tier: row.tier,
    score: row.score,
    skills,
    about_tags: buildAboutTags({
      personalAnswers,
      seniorityBadge,
      hasValidatedLevel,
      tierLabel,
      availability: row.availability,
      jobSearchStatus: row.jobSearchStatus,
    }),
    availability: row.availability,
    availability_label: resolveAvailabilityLabel(row.availability) ?? null,
    verified_at: row.verifiedAt,
    strong_competencies: row.strongCompetencies,
    share_token: row.shareToken,
    region: row.location ?? row.country ?? null,
    is_saved: context.is_saved,
    offer_sent: context.offer_sent,
    offer_status: context.offer_status,
  };
}
