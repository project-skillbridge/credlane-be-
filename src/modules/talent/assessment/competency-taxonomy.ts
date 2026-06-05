/**
 * Competency taxonomy per skill track.
 *
 * Source of truth: CredLane Backend Engineering Spec v1.0, Section 5.1.
 * Every text question in the bank (and every AI-generated question) MUST be
 * tagged with exactly one competency from the track-specific list below.
 *
 * Used by:
 *   - QuestionGenerationService / persistGeneratedQuestions: validate before
 *     persisting so the bank only ever contains taxonomy-valid competencies.
 *   - AdvancedAssessmentService.extractStrong/WeakCompetencies: produces real
 *     labels for the guidance report (instead of UUIDs).
 *   - EmployerPoolProfileService.deriveCompetencies: produces clean
 *     competency_scores keys for the employer-facing pool profile.
 */

export const COMPETENCY_TAXONOMY: Record<string, readonly string[]> = {
  software_eng: [
    'sql_queries',
    'api_design',
    'debugging',
    'system_design',
    'code_quality',
    'security_awareness',
    'performance',
    'testing',
    'version_control',
    'documentation',
  ],
  data_analytics: [
    'sql_queries',
    'data_interpretation',
    'statistical_reasoning',
    'data_quality',
    'visualisation',
    'stakeholder_comms',
    'python_logic',
    'ambiguity_handling',
    'reporting',
    'business_acumen',
  ],
  product_mgmt: [
    'prioritisation',
    'stakeholder_mgmt',
    'roadmap_thinking',
    'user_empathy',
    'scoping',
    'tradeoff_analysis',
    'metrics_definition',
    'communication',
    'risk_assessment',
    'delivery',
  ],
  design_ux: [
    'user_research',
    'wireframing_thinking',
    'usability_principles',
    'visual_hierarchy',
    'feedback_integration',
    'accessibility',
    'prototyping_logic',
    'stakeholder_comms',
    'iteration',
    'design_systems',
  ],
  marketing: [
    'campaign_thinking',
    'audience_targeting',
    'channel_strategy',
    'copywriting',
    'analytics_interpretation',
    'brand_consistency',
    'budget_thinking',
    'stakeholder_comms',
    'content_strategy',
    'performance_analysis',
  ],
  customer_support: [
    'de_escalation',
    'empathy',
    'policy_application',
    'written_communication',
    'problem_solving',
    'escalation_judgment',
    'tone_control',
    'process_thinking',
    'follow_through',
    'product_knowledge',
  ],
  content_writing: [
    'tone_adaptation',
    'structure',
    'audience_awareness',
    'brevity',
    'brand_voice',
    'research_integration',
    'editing_judgment',
    'headline_thinking',
    'persuasion',
    'format_flexibility',
  ],
} as const;

export const FALLBACK_COMPETENCY = 'general';

/** Normalises a human-readable competency label to a storage slug. */
export function slugifyCompetency(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Resolves the best competency slug for a bank question or session payload.
 * Prefers the persisted column unless it is the import fallback (`general`),
 * then falls back to metadata.source_competency from the CredLane import.
 */
export function resolveQuestionCompetency(input: {
  competency?: string | null;
  metadata?: Record<string, unknown> | null;
}): string | null {
  const metadata = input.metadata ?? {};
  const columnCompetency = input.competency
    ? slugifyCompetency(input.competency)
    : null;
  const sourceCompetency =
    typeof metadata.source_competency === 'string' &&
    metadata.source_competency.trim().length > 0
      ? slugifyCompetency(metadata.source_competency)
      : null;
  const metadataCompetency =
    typeof metadata.competency === 'string' &&
    metadata.competency.trim().length > 0
      ? slugifyCompetency(metadata.competency)
      : null;

  const candidates = [columnCompetency, sourceCompetency, metadataCompetency];
  const specific = candidates.find(
    (value) => value && value !== FALLBACK_COMPETENCY,
  );
  if (specific) {
    return specific;
  }

  return columnCompetency ?? sourceCompetency ?? metadataCompetency;
}

/**
 * Returns the list of valid competencies for a track, or an empty list if the
 * track isn't in the taxonomy (unknown / custom tracks).
 */
export function competenciesForTrack(
  track: string | null | undefined,
): readonly string[] {
  if (!track) return [];
  return COMPETENCY_TAXONOMY[track.toLowerCase()] ?? [];
}

/**
 * True when `competency` is in the taxonomy for `track`.
 * Case-insensitive. Empty / null / undefined are always invalid.
 *
 * Unknown tracks fall through as invalid; callers should fall back to
 * FALLBACK_COMPETENCY rather than persist a garbage tag.
 */
export function isValidCompetency(
  track: string | null | undefined,
  competency: string | null | undefined,
): boolean {
  if (!competency) return false;
  const list = competenciesForTrack(track);
  return list.includes(competency.toLowerCase());
}

/**
 * Normalises a competency value for storage:
 *   - Returns the lowercased competency if it's valid for the track.
 *   - Returns the first valid competency for the track when the input is invalid.
 *   - Returns FALLBACK_COMPETENCY ('general') when the track itself is unknown.
 *
 * This guarantees the bank never stores a garbage competency string.
 */
export function normaliseCompetency(
  track: string | null | undefined,
  competency: string | null | undefined,
): string {
  const list = competenciesForTrack(track);
  if (list.length === 0) {
    return FALLBACK_COMPETENCY;
  }
  if (competency && isValidCompetency(track, competency)) {
    return competency.toLowerCase();
  }
  return list[0];
}

/**
 * Dedupe + lowercase + filter against the taxonomy. Used to clean the
 * strong/weak competency arrays before they flow into the guidance prompt
 * and the employer pool profile.
 */
export function sanitiseCompetencyList(
  track: string | null | undefined,
  competencies: ReadonlyArray<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of competencies) {
    if (!raw) continue;
    const normalised = raw.toLowerCase();
    if (seen.has(normalised)) continue;
    // Unknown tracks: keep the raw label; we have nothing better.
    if (
      competenciesForTrack(track).length === 0 ||
      isValidCompetency(track, normalised)
    ) {
      seen.add(normalised);
      result.push(normalised);
    }
  }

  return result;
}
