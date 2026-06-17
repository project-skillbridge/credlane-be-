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
  frontend_developer: [
    'performance_optimisation',
    'accessibility',
    'state_management',
    'component_architecture',
    'release_management',
    'stakeholder_communication',
  ],
  backend_developer: [
    'api_design',
    'database_performance',
    'incident_response',
    'security',
    'scalability',
    'service_reliability',
  ],
  mobile_developer: [
    'offline_support',
    'app_performance',
    'release_coordination',
    'platform_constraints',
    'crash_triage',
    'store_compliance',
  ],
  fullstack_developer: [
    'end_to_end_delivery',
    'api_integration',
    'system_design',
    'cross_stack_debugging',
    'technical_trade_offs',
    'release_planning',
  ],
  cloud_devops: [
    'ci_cd',
    'observability',
    'incident_response',
    'infrastructure_cost',
    'security_hardening',
    'release_automation',
  ],
  data_engineer: [
    'pipeline_reliability',
    'data_quality',
    'schema_evolution',
    'cost_optimisation',
    'sla_management',
    'incident_response',
  ],
  quality_assurance: [
    'test_strategy',
    'release_risk',
    'automation_trade_offs',
    'defect_triage',
    'regression_planning',
    'stakeholder_sign_off',
  ],
  ml_engineer: [
    'model_deployment',
    'data_drift',
    'evaluation_design',
    'production_monitoring',
    'experimentation',
    'stakeholder_alignment',
  ],
  cybersecurity: [
    'threat_response',
    'access_control',
    'vulnerability_management',
    'compliance',
    'incident_containment',
    'risk_communication',
  ],
  product_manager: [
    'prioritisation',
    'stakeholder_management',
    'roadmap_planning',
    'metrics',
    'discovery',
    'launch_planning',
  ],
  product_designer: [
    'user_research',
    'accessibility',
    'design_systems',
    'stakeholder_feedback',
    'usability',
    'handoff_quality',
  ],
  ux_researcher: [
    'research_design',
    'stakeholder_influence',
    'synthesis',
    'recruitment',
    'insight_communication',
    'ethics',
  ],
  brand_designer: [
    'brand_consistency',
    'client_management',
    'visual_systems',
    'campaign_design',
    'guidelines',
    'stakeholder_feedback',
  ],
  marketing: [
    'channel_strategy',
    'cac_optimisation',
    'referral_growth',
    'experimentation',
    'budget_allocation',
    'funnel_analysis',
    'content_strategy',
    'seo',
    'editorial_planning',
    'brand_voice',
    'performance_tracking',
    'stakeholder_alignment',
    'community_management',
    'crisis_response',
    'content_calendar',
    'influencer_relations',
    'brand_safety',
    'engagement_metrics',
    'roas_optimisation',
    'attribution',
    'budget_pacing',
    'creative_testing',
    'channel_mix',
    'client_reporting',
  ],
  data_analyst: [
    'data_quality',
    'strong_analytical_reasoning',
    'analysis_scope',
    'metric_definition',
    'visualisation',
    'methodology',
  ],
  business_analyst: [
    'requirements_clarity',
    'scope_management',
    'process_analysis',
    'stakeholder_facilitation',
    'mvp_definition',
    'change_impact',
  ],
  bi_developer: [
    'dashboard_accuracy',
    'data_modelling',
    'self_service_enablement',
    'performance',
    'governance',
    'stakeholder_support',
  ],
  data_scientist: [
    'model_selection',
    'bias_detection',
    'experiment_design',
    'stakeholder_communication',
    'production_readiness',
    'statistical_rigor',
  ],
  operations_manager: [
    'process_efficiency',
    'vendor_management',
    'team_capacity',
    'compliance',
    'escalation',
    'cost_control',
  ],
  customer_success: [
    'churn_prevention',
    'account_management',
    'escalation',
    'renewal_strategy',
    'product_adoption',
    'executive_relationships',
  ],
  project_manager: [
    'scope_control',
    'risk_management',
    'stakeholder_communication',
    'resource_planning',
    'dependency_management',
    'delivery_recovery',
  ],
  hr_people_ops: [
    'performance_management',
    'policy_design',
    'conflict_resolution',
    'compensation_equity',
    'hiring_process',
    'compliance',
  ],
} as const;

export const FALLBACK_COMPETENCY = 'general';

/**
 * Normalises a human-readable competency label to a storage slug.
 * Returns null when the input contains no alphanumeric characters
 * (e.g. "!!!!") so callers never persist an empty slug.
 */
export function slugifyCompetency(value: string): string | null {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug.length > 0 ? slug : null;
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
