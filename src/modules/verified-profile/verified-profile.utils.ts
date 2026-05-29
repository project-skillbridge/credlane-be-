import { VerifiedLevel } from '../assessments/entities';
import type { AdvancedAssessmentGeneratedQuestion } from '../talent/assessment/advanced-assessment-ai.service';

const SENIORITY_LABELS: Record<string, string> = {
  entry: 'Entry Level',
  [VerifiedLevel.JUNIOR]: 'Junior Level',
  [VerifiedLevel.MID]: 'Mid Level',
  [VerifiedLevel.SENIOR]: 'Senior Level',
  [VerifiedLevel.EXPERT]: 'Expert Level',
};

const PROFESSIONAL_COMPETENCIES = new Set([
  'technical_reasoning',
  'analytical_thinking',
  'problem_solving',
  'critical_thinking',
  'data_analysis',
  'technical_aptitude',
  'industry_knowledge',
  'strategic_thinking',
  'attention_to_detail',
  'domain_expertise',
  'systems_thinking',
  'technical_communication',
  'quality_assurance',
  'requirements_analysis',
  'solution_design',
  'implementation',
  'technical_writing',
  'code_quality',
  'testing',
  'architecture',
  'stakeholder_management',
  'project_management',
  'product_sense',
  'business_acumen',
  'research',
  'quantitative_analysis',
  'experimentation',
  'technical_planning',
  'decision_making',
]);

const SOFT_COMPETENCIES = new Set([
  'communication',
  'collaboration',
  'teamwork',
  'leadership',
  'adaptability',
  'emotional_intelligence',
  'creativity',
  'initiative',
  'ownership',
  'accountability',
  'mentoring',
  'conflict_resolution',
  'negotiation',
  'empathy',
  'resilience',
  'time_management',
  'self_awareness',
  'coaching',
  'delegation',
  'cross_functional_collaboration',
  'feedback',
  'growth_mindset',
  'continuous_learning',
  'interpersonal_skills',
  'cultural_awareness',
  'remote_collaboration',
  'change_management',
  'influence',
  'networking',
  'stress_management',
]);

export function formatSlugLabel(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function readPersonalAnswers(
  store: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!store || typeof store !== 'object' || Array.isArray(store)) {
    return {};
  }
  const { _meta: _ignored, ...answers } = store;
  return answers;
}

export function resolveSkills(
  answers: Record<string, unknown> | null | undefined,
): string[] | undefined {
  if (!answers) return undefined;
  const tools = answers.tools;
  const items: string[] = [];

  if (Array.isArray(tools)) {
    for (const entry of tools) {
      if (typeof entry === 'string' && entry.trim()) {
        items.push(entry.trim());
      }
    }
  }

  const other = answers.tools_other;
  if (typeof other === 'string' && other.trim()) {
    items.push(other.trim());
  }

  return items.length > 0 ? items : undefined;
}

export function resolveRoleLabel(
  profileTrack: string | null,
  profileRoleTrack: string | null,
  specialization: string | null,
  answers: Record<string, unknown>,
): string {
  const track = profileTrack ?? profileRoleTrack;
  if (track) {
    return formatSlugLabel(track);
  }

  const spec =
    specialization ??
    (typeof answers.specialization === 'string'
      ? answers.specialization
      : null);

  if (spec) {
    return formatSlugLabel(spec);
  }

  return 'Talent';
}

export function resolveGoalLabel(goal: string | null): string {
  if (!goal) {
    return '';
  }
  return formatSlugLabel(goal);
}

export function readSessionQuestions(
  generatedQuestionsJson: Record<string, unknown> | null,
): AdvancedAssessmentGeneratedQuestion[] {
  if (
    !generatedQuestionsJson ||
    typeof generatedQuestionsJson !== 'object' ||
    Array.isArray(generatedQuestionsJson)
  ) {
    return [];
  }

  const questions = (generatedQuestionsJson as { questions?: unknown })
    .questions;
  return Array.isArray(questions)
    ? (questions as AdvancedAssessmentGeneratedQuestion[])
    : [];
}

export function rubricScorePercentage(
  evaluation: Record<string, unknown> | null,
  isLt3: boolean,
): number | null {
  if (
    !evaluation ||
    typeof evaluation.total !== 'number' ||
    !Number.isFinite(evaluation.total)
  ) {
    return null;
  }

  const max = isLt3 ? 6 : 12;
  const clampedTotal = Math.min(max, Math.max(0, evaluation.total));
  return Math.round((clampedTotal / max) * 100);
}

export function resolveSeniorityBadge(
  validatedLevel: VerifiedLevel | string | null | undefined,
): string | undefined {
  if (!validatedLevel) return undefined;
  return SENIORITY_LABELS[validatedLevel] ?? formatSlugLabel(validatedLevel);
}

export function resolveTierLabel(
  tier: string | null | undefined,
): string | undefined {
  if (!tier) return undefined;
  switch (tier) {
    case 'job_ready':
      return 'Job Ready';
    case 'emerging':
      return 'Emerging';
    case 'not_ready':
      return 'Not Ready';
    default:
      return formatSlugLabel(tier);
  }
}

export function resolveKeyStrengths(
  competencyScores: Record<string, number> | null | undefined,
  strongCompetencies: string[] | null | undefined,
): { competency: string; label: string; percentage: number }[] | undefined {
  if (
    !competencyScores ||
    !strongCompetencies ||
    strongCompetencies.length === 0
  ) {
    return undefined;
  }

  const items: { competency: string; label: string; percentage: number }[] = [];
  const strongSet = new Set(strongCompetencies.map((s) => s.toLowerCase()));

  for (const [competency, percentage] of Object.entries(competencyScores)) {
    if (strongSet.has(competency.toLowerCase())) {
      items.push({
        competency,
        label: formatSlugLabel(competency),
        percentage,
      });
    }
  }

  items.sort((a, b) => b.percentage - a.percentage);

  return items.length > 0 ? items : undefined;
}

export function categorizeCompetencies(
  competencyScores: Record<string, number> | null | undefined,
): {
  professionalSkills: { label: string; percentage: number }[] | undefined;
  softSkills: { label: string; percentage: number }[] | undefined;
} {
  if (!competencyScores) {
    return { professionalSkills: undefined, softSkills: undefined };
  }

  const professional: { label: string; percentage: number }[] = [];
  const soft: { label: string; percentage: number }[] = [];

  for (const [competency, percentage] of Object.entries(competencyScores)) {
    const key = competency.toLowerCase().trim();
    const item = { label: formatSlugLabel(competency), percentage };

    if (PROFESSIONAL_COMPETENCIES.has(key)) {
      professional.push(item);
    } else if (SOFT_COMPETENCIES.has(key)) {
      soft.push(item);
    } else {
      professional.push(item);
    }
  }

  const sortByPercentage = (
    a: { percentage: number },
    b: { percentage: number },
  ) => b.percentage - a.percentage;

  return {
    professionalSkills:
      professional.length > 0 ? professional.sort(sortByPercentage) : undefined,
    softSkills: soft.length > 0 ? soft.sort(sortByPercentage) : undefined,
  };
}

export function buildShareUrl(
  frontendUrl: string,
  token: string | null | undefined,
): string {
  if (!token) return '';
  const base = frontendUrl.replace(/\/+$/, '');
  return `${base}/verified-profiles/${token}`;
}

export function buildQrCodeUrl(shareUrl: string): string | undefined {
  if (!shareUrl) return undefined;
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;
}

export function compactStrings(values: Array<string | null | undefined>) {
  const items: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    items.push(trimmed);
  }

  return items;
}

export function resolveExperienceLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  switch (value) {
    case '0_1_yr':
      return '0-1 yr exp.';
    case '1_3_yrs':
      return '1-3 yrs exp.';
    case '3_5_yrs':
      return '3-5 yrs exp.';
    case '5_10_yrs':
      return '5-10 yrs exp.';
    case '10_plus_yrs':
      return '10+ yrs exp.';
    default:
      return formatSlugLabel(value);
  }
}

export function resolveAvailabilityLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  switch (value) {
    case 'immediately_available':
      return 'Immediately Available';
    case 'on_notice_under_1_month':
      return 'On Notice Under 1 Month';
    case 'on_notice_1_3_months':
      return 'On Notice 1-3 Months';
    case 'employed_flexible':
      return 'Employed, Flexible';
    default:
      return formatSlugLabel(value);
  }
}

export function resolveJobSearchStatusLabel(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') return undefined;

  switch (value) {
    case 'actively_looking':
      return 'Actively Looking';
    case 'open_to_opportunities':
    case 'open_to_right_opportunity':
      return 'Open to Work';
    case 'not_looking':
      return 'Not Looking';
    case 'just_exploring':
      return 'Just Exploring';
    default:
      return formatSlugLabel(value);
  }
}

export function resolveWorkArrangementLabels(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return compactStrings(
    values.map((item) => {
      if (typeof item !== 'string') return undefined;

      switch (item) {
        case 'fully_remote':
          return 'Fully Remote';
        case 'hybrid':
          return 'Hybrid';
        case 'in_person_only':
          return 'In Person';
        case 'flexible':
          return 'Flexible';
        case 'open_to_any':
          return 'Open to Any';
        default:
          return formatSlugLabel(item);
      }
    }),
  );
}
