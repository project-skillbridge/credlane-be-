import type { AdvancedAssessmentGeneratedQuestion } from '../talent/assessment/advanced-assessment-ai.service';

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
  answers: Record<string, unknown>,
): string[] | undefined {
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
  const spec =
    specialization ??
    (typeof answers.specialization === 'string'
      ? answers.specialization
      : null);

  if (spec) {
    return formatSlugLabel(spec);
  }

  const track = profileTrack ?? profileRoleTrack;
  if (track) {
    return formatSlugLabel(track);
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
