import { VerifiedLevel } from '../../assessments/entities';

export function metadataDifficulty(
  level: VerifiedLevel,
): 'easy' | 'medium' | 'hard' {
  if (level === VerifiedLevel.JUNIOR) {
    return 'easy';
  }
  if (level === VerifiedLevel.MID) {
    return 'medium';
  }
  return 'hard';
}

export function resolveIndustryContext(
  context: Record<string, unknown>,
): string | undefined {
  const industries = context['industries'];
  if (Array.isArray(industries) && industries.length > 0) {
    return industries.map(String).join(', ');
  }

  const jobTitle = context['job_title'];
  return typeof jobTitle === 'string' && jobTitle.trim().length > 0
    ? jobTitle.trim()
    : undefined;
}

export function resolveCompetencyHint(
  context: Record<string, unknown>,
): string | undefined {
  const specialization = context['specialization'];
  if (typeof specialization === 'string' && specialization.trim().length > 0) {
    return specialization.trim();
  }

  const primaryToolDuration = context['primary_tool_duration'];
  return typeof primaryToolDuration === 'string'
    ? primaryToolDuration
    : undefined;
}
