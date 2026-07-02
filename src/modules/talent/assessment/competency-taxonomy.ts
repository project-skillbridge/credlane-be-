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
    'component_architecture', // structuring and composing UI components
    'state_management', // local vs global state, data flow
    'css_and_layout', // responsive design, flexbox, grid, overflow
    'api_integration', // fetching, async handling, error/loading states
    'performance_optimisation', // rendering, bundle size, lazy loading
    'accessibility', // ARIA, semantic HTML, WCAG compliance
    'testing', // unit and integration testing decisions
    'debugging', // diagnosing UI bugs, devtools, re-render issues
    'code_review', // reviewing frontend PRs for quality and risk
    'tooling_and_build', // bundlers, build config, CI for frontend
  ],

  backend_developer: [
    'api_design', // REST/GraphQL structure, versioning, contracts
    'database_design', // schema, indexing, query design, migrations
    'authentication_and_security', // JWT, OAuth, input validation, injection risks
    'error_handling', // graceful errors, status codes, logging
    'performance_and_scalability', // caching, connection pooling, load decisions
    'testing', // unit, integration, and contract testing
    'code_review', // reviewing backend PRs for risk and correctness
    'incident_response', // diagnosing and recovering from production issues
    'service_integration', // third-party APIs, webhooks, async messaging
    'deployment_awareness', // containerisation, CI/CD handoff, env config
  ],

  mobile_developer: [
    'navigation_and_routing', // app navigation patterns and stack management
    'state_management', // managing app-wide and local state
    'offline_support', // local persistence, sync strategies, conflict
    'api_integration', // mobile-specific request handling, retry logic
    'performance_and_memory', // frame rates, memory leaks, battery impact
    'platform_constraints', // iOS vs Android differences and limitations
    'crash_triage', // diagnosing, prioritising, and fixing crashes
    'store_compliance', // App Store / Play Store rules and submissions
    'ui_and_animations', // mobile-specific UI patterns and motion
    'testing', // unit, UI automation, and E2E testing on device
  ],

  fullstack_developer: [
    'api_design_and_integration', // building and consuming APIs end-to-end
    'database_design', // schema, queries, ORM trade-offs
    'authentication_and_security', // full-stack auth flows, session management
    'state_management', // frontend state tied to backend data sources
    'system_design', // architecture decisions across the full stack
    'debugging_and_diagnosis', // tracing bugs across frontend and backend layers
    'performance', // identifying bottlenecks across the full stack
    'testing', // testing strategy across frontend and backend
    'code_review', // reviewing full-stack PRs holistically
    'deployment_and_delivery', // CI/CD, containerisation, environment parity
  ],

  cloud_devops: [
    'ci_cd_pipeline_design', // building, maintaining, and optimising pipelines
    'infrastructure_as_code', // Terraform, CloudFormation, config management
    'container_orchestration', // Docker, Kubernetes decisions and trade-offs
    'observability_and_monitoring', // logs, metrics, tracing, alerting strategy
    'incident_response', // on-call, root cause analysis, postmortems
    'security_hardening', // IAM, secrets management, network policy
    'cost_optimisation', // right-sizing, reserved capacity, spend decisions
    'release_automation', // deployment strategies, rollbacks, feature flags
    'reliability_and_sla', // SLOs, error budgets, availability planning
    'cloud_architecture', // multi-region, failover, scaling design
  ],

  data_engineer: [
    'pipeline_design', // ETL/ELT architecture and tool selection
    'data_quality', // validation, monitoring, and error handling in pipelines
    'schema_design', // modelling for analytics vs transactional workloads
    'orchestration', // scheduling, DAGs, dependency management
    'streaming_vs_batch', // choosing the right processing model for the use case
    'storage_and_partitioning', // file formats, partitioning, compression trade-offs
    'debugging_pipelines', // diagnosing and fixing failures in data pipelines
    'schema_evolution', // handling breaking changes without breaking consumers
    'cost_optimisation', // compute and storage trade-offs in data infrastructure
    'stakeholder_handoff', // delivering reliable, documented data for downstream users
  ],

  quality_assurance: [
    'test_strategy', // deciding what to test, at what level, and why
    'test_automation', // writing and maintaining sustainable automated tests
    'regression_planning', // managing regression suites across releases
    'defect_triage', // prioritising bugs by severity, risk, and impact
    'exploratory_testing', // structured exploratory approaches and charter design
    'api_and_integration_testing', // testing APIs, contracts, and integration points
    'performance_testing', // load, stress, and soak testing decisions
    'release_risk_assessment', // evaluating go/no-go decisions for releases
    'test_environment_management', // env parity, test data strategy, isolation
    'stakeholder_communication', // reporting quality status and risk clearly
  ],

  ml_engineer: [
    'model_training_and_iteration', // training pipelines, hyperparameter decisions
    'feature_engineering', // designing, selecting, and transforming features
    'model_evaluation', // choosing and interpreting evaluation metrics
    'production_deployment', // model serving, latency, and scalability
    'monitoring_and_drift', // detecting and responding to model degradation
    'experimentation', // A/B testing, shadow deployments, online evaluation
    'data_pipeline_for_ml', // data quality and preparation for training
    'bias_and_fairness', // identifying and mitigating model bias
    'debugging_ml', // diagnosing training instability and inference issues
    'stakeholder_communication', // explaining model behaviour to non-technical audiences
  ],

  cybersecurity: [
    'threat_modelling', // identifying attack surfaces and risk vectors
    'access_control', // IAM design, least privilege, RBAC
    'vulnerability_management', // scanning, prioritising, and remediating CVEs
    'incident_response', // containment, eradication, and recovery
    'secure_development', // SAST, DAST, secure code review practices
    'network_security', // firewalls, segmentation, traffic monitoring
    'compliance_and_governance', // SOC2, ISO 27001, GDPR, audit readiness
    'cryptography_and_secrets', // key management, TLS, secrets handling
    'risk_communication', // presenting risk clearly to non-technical stakeholders
    'social_engineering_defence', // phishing awareness, insider threat scenarios
  ],

  product_manager: [
    'prioritisation', // frameworks and judgment calls under competing pressure
    'discovery_and_research', // problem validation, user research, opportunity sizing
    'roadmap_planning', // sequencing, trade-offs, and long-term thinking
    'stakeholder_management', // aligning, managing, and communicating with stakeholders
    'metrics_and_analysis', // defining, tracking, and interpreting success metrics
    'launch_planning', // release coordination, GTM, rollout strategy
    'requirements_and_specs', // writing clear, actionable product requirements
    'trade_off_navigation', // making decisions with incomplete or conflicting information
    'cross_functional_collaboration', // working with design, engineering, and data
    'customer_feedback_loops', // synthesising user feedback into product decisions
  ],

  product_designer: [
    'user_research_and_synthesis', // planning and applying research to design decisions
    'information_architecture', // structuring flows, navigation, and content hierarchy
    'interaction_design', // patterns, micro-interactions, and state design
    'visual_design', // typography, colour, spacing, and visual hierarchy
    'accessibility', // WCAG compliance and inclusive design decisions
    'design_systems', // building, maintaining, and scaling component libraries
    'prototyping', // fidelity decisions, tool choice, and test preparation
    'stakeholder_feedback', // handling critique, pushback, and conflicting direction
    'design_critique', // giving and receiving structured, useful critique
    'handoff_quality', // preparing specs, annotations, and assets for engineering
  ],

  ux_researcher: [
    'research_planning', // choosing methods, scoping studies, and setting objectives
    'participant_recruitment', // finding and screening the right participants
    'interview_and_facilitation', // running effective sessions without leading participants
    'usability_testing', // planning and executing usability studies
    'synthesis_and_analysis', // turning raw data into clear, actionable insights
    'insight_communication', // presenting findings to stakeholders compellingly
    'stakeholder_influence', // getting research to drive real product decisions
    'survey_design', // writing valid, unbiased, and structured surveys
    'ethics_and_bias', // research ethics, consent, and avoiding bias
    'mixed_methods', // combining qualitative and quantitative approaches
  ],

  brand_designer: [
    'brand_identity_design', // logo, marks, and core visual identity decisions
    'visual_systems', // colour, typography, and design language
    'brand_guidelines', // creating and enforcing brand standards
    'campaign_design', // adapting brand to campaign and channel needs
    'stakeholder_management', // handling feedback, approvals, and conflicting direction
    'cross_channel_consistency', // applying brand coherently across touchpoints
    'art_direction', // directing visual output from photographers, illustrators, etc.
    'presentation_and_pitch', // presenting brand concepts and rationale clearly
    'production_and_delivery', // preparing final files, specs, and handoff packages
    'brand_evolution', // refreshing or extending an existing brand system
  ],

  marketing: [
    'campaign_strategy', // planning and executing multi-channel campaigns
    'content_strategy', // content planning, editorial calendars, and direction
    'performance_marketing', // paid media decisions, ROAS optimisation, attribution
    'seo_and_organic_growth', // SEO strategy, keyword decisions, organic channel management
    'brand_voice_and_messaging', // brand consistency across copy and communications
    'social_media_management', // channel management, community, and engagement
    'influencer_and_partnerships', // managing influencer relationships and co-marketing
    'analytics_and_reporting', // tracking, interpreting, and reporting on marketing metrics
    'budget_allocation', // managing and optimising marketing spend
    'funnel_and_conversion', // understanding and improving conversion across the funnel
  ],

  data_analyst: [
    'exploratory_data_analysis', // profiling, cleaning, and initial investigation
    'sql_and_querying', // writing and optimising SQL for analysis
    'metric_definition', // defining clear, measurable, and useful metrics
    'statistical_reasoning', // interpreting distributions, significance, and confidence
    'data_visualisation', // choosing and designing charts that communicate clearly
    'analysis_storytelling', // presenting findings to stakeholders in a useful way
    'data_quality_assessment', // identifying and handling dirty, missing, or incorrect data
    'ab_test_analysis', // designing and interpreting experiments correctly
    'root_cause_analysis', // diagnosing drops, spikes, and anomalies in data
    'cross_functional_collaboration', // working with PMs, engineers, and business stakeholders
  ],

  business_analyst: [
    'requirements_elicitation', // gathering, clarifying, and documenting requirements
    'process_mapping', // documenting and analysing current-state workflows
    'gap_analysis', // identifying gaps between current and desired state
    'stakeholder_facilitation', // running workshops and aligning conflicting stakeholders
    'scope_management', // managing scope changes and trade-offs clearly
    'user_story_writing', // translating requirements into clear, testable stories
    'acceptance_criteria', // defining unambiguous done conditions
    'business_case_development', // justifying investments with clear rationale
    'change_impact_assessment', // evaluating downstream consequences of proposed changes
    'solution_evaluation', // assessing options against requirements and constraints
  ],

  bi_developer: [
    'data_modelling_for_bi', // star schema, dimensional modelling, and grain decisions
    'sql_and_query_optimisation', // writing performant queries for reporting
    'dashboard_design', // layout, hierarchy, and clarity of dashboards
    'kpi_definition', // helping stakeholders define the right metrics
    'self_service_enablement', // designing reports and models for non-technical users
    'performance_optimisation', // diagnosing and fixing slow queries and reports
    'governance_and_access', // row-level security, data access, and certified datasets
    'stakeholder_requirements', // translating business questions into BI specifications
    'data_freshness_and_reliability', // managing refresh schedules, SLAs, and failure handling
    'tool_proficiency', // Power BI, Tableau, or Looker-specific decisions and trade-offs
  ],

  data_scientist: [
    'exploratory_data_analysis', // data investigation, profiling, and hypothesis forming
    'feature_engineering', // transforming and selecting features for modelling
    'model_selection_and_evaluation', // choosing and comparing models against the right metrics
    'experiment_design', // designing statistically valid experiments
    'bias_and_fairness', // detecting and mitigating model and data bias
    'statistical_modelling', // applying statistical methods correctly
    'production_readiness', // preparing models for handoff and deployment
    'stakeholder_communication', // explaining results and limitations to non-technical audiences
    'time_series_and_forecasting', // forecasting methods, seasonality, and temporal patterns
    'business_impact_framing', // connecting model outputs to measurable business value
  ],

  operations_manager: [
    'process_design', // designing and optimising operational workflows
    'vendor_management', // selecting, managing, and evaluating third-party suppliers
    'team_capacity_planning', // forecasting and allocating team resources
    'escalation_management', // handling and resolving operational escalations
    'cost_control', // budget management and spend optimisation decisions
    'compliance_and_risk', // ensuring operations meet regulatory requirements
    'kpi_tracking', // defining and monitoring operational performance metrics
    'cross_team_coordination', // aligning work across functions and departments
    'incident_management', // responding to and recovering from operational disruptions
    'continuous_improvement', // identifying and implementing process improvements
  ],

  customer_success: [
    'onboarding', // getting customers to value quickly and confidently
    'product_adoption', // driving feature usage and habit formation
    'churn_risk_identification', // spotting early warning signs and acting on them
    'escalation_management', // handling and de-escalating unhappy customers
    'renewal_strategy', // planning and executing renewal and expansion conversations
    'executive_relationships', // building trust and rapport with senior decision-makers
    'health_scoring', // tracking and interpreting account health signals
    'qbr_facilitation', // planning and running effective quarterly business reviews
    'cross_sell_and_upsell', // identifying and pursuing expansion opportunities
    'customer_feedback_loops', // closing the loop between customer input and product teams
  ],

  project_manager: [
    'project_planning', // creating realistic, risk-aware plans and schedules
    'scope_management', // handling change requests and preventing scope creep
    'risk_management', // identifying, assessing, and mitigating project risks
    'stakeholder_communication', // reporting progress and managing expectations clearly
    'resource_planning', // allocating and managing team capacity across work
    'dependency_management', // tracking and unblocking cross-team dependencies
    'delivery_recovery', // getting delayed or derailed projects back on track
    'milestone_management', // tracking and reporting on delivery milestones
    'budget_tracking', // monitoring spend and forecasting project costs
    'team_coordination', // keeping cross-functional teams aligned and unblocked
  ],

  hr_people_ops: [
    'hiring_and_talent_acquisition', // designing and running effective hiring processes
    'onboarding_design', // structuring onboarding that gets people productive fast
    'performance_management', // goal-setting, feedback cycles, and performance reviews
    'compensation_and_equity', // pay decisions, benchmarking, and equity considerations
    'conflict_resolution', // mediating and resolving employee disputes
    'policy_design', // writing clear, fair, and enforceable people policies
    'compliance_and_labour_law', // keeping people practices legally compliant
    'employee_engagement', // measuring and improving how people feel about their work
    'offboarding', // handling exits compliantly and constructively
    'people_analytics', // using people data to inform decisions and spot trends
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
