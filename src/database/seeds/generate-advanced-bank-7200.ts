/**
 * Advanced assessment bank generator — 7,200 questions.
 *
 * 25 role codes × 4 levels × 72 questions = 7,200
 * Per role+level: 20 mcq + 40 open_ended_scenario + 6 LT-1 + 6 LT-2
 *
 * Sized for ~3 zero-overlap sessions per role+level (runtime pulls 5+10+2+2).
 * Role-specific scenario stems live in role-scenario-bank.ts.
 *
 * Run:
 *   pnpm seed:generate:advanced
 *
 * Import:
 *   QUESTION_BANK_SEED_FILE=data/question-banks/seed-advanced.json pnpm seed
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ROLE_SCENARIOS, type RoleScenarioBank } from './role-scenario-bank';

type Level = 'junior' | 'mid' | 'senior' | 'expert';
type Format = 'mcq' | 'long_text' | 'open_ended_scenario';

const INDUSTRIES = [
  'fintech',
  'saas',
  'ecommerce',
  'healthtech',
  'logistics',
] as const;

const LEVELS: Level[] = ['junior', 'mid', 'senior', 'expert'];
const LEVEL_CODE: Record<Level, string> = {
  junior: 'JR',
  mid: 'MID',
  senior: 'SR',
  expert: 'EXP',
};

const TARGET_TOTAL = 7_200;
const GENERATED_BY = 'Trojan — Claude Sonnet';

const SET = {
  mcq: 20,
  open: 40,
  lt1: 6,
  lt2: 6,
} as const;

const RUNTIME_MIN = { mcq: 5, shortText: 10, lt1: 2, lt2: 2 } as const;

type RoleMeta = {
  code: string;
  role: string;
  family: string;
  track: string;
  competencies: string[];
  mcqTypes: string[];
  longWorkTypes: string[];
  longScenarioTypes: string[];
  openTypes: string[];
};

const ROLES: RoleMeta[] = [
  {
    code: 'FED',
    role: 'Frontend Engineer',
    family: 'Engineering',
    track: 'frontend_developer',
    competencies: [
      'Performance Optimisation',
      'Accessibility',
      'State Management',
      'Component Architecture',
      'Release Management',
      'Stakeholder Communication',
    ],
    mcqTypes: [
      'architecture_trade_offs',
      'debugging_judgment',
      'incident_response',
    ],
    longWorkTypes: ['code_review', 'debugging_judgment', 'system_design'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'system_design', 'debugging_judgment'],
  },
  {
    code: 'BED',
    role: 'Backend Engineer',
    family: 'Engineering',
    track: 'backend_developer',
    competencies: [
      'API Design',
      'Database Performance',
      'Incident Response',
      'Security',
      'Scalability',
      'Service Reliability',
    ],
    mcqTypes: [
      'architecture_trade_offs',
      'debugging_judgment',
      'incident_response',
    ],
    longWorkTypes: ['code_review', 'debugging_judgment', 'system_design'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'system_design', 'debugging_judgment'],
  },
  {
    code: 'MOB',
    role: 'Mobile Engineer',
    family: 'Engineering',
    track: 'mobile_developer',
    competencies: [
      'Offline Support',
      'App Performance',
      'Release Coordination',
      'Platform Constraints',
      'Crash Triage',
      'Store Compliance',
    ],
    mcqTypes: [
      'architecture_trade_offs',
      'debugging_judgment',
      'incident_response',
    ],
    longWorkTypes: ['code_review', 'debugging_judgment', 'system_design'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'system_design', 'debugging_judgment'],
  },
  {
    code: 'FSD',
    role: 'Fullstack Engineer',
    family: 'Engineering',
    track: 'fullstack_developer',
    competencies: [
      'End-to-End Delivery',
      'API Integration',
      'System Design',
      'Cross-Stack Debugging',
      'Technical Trade-offs',
      'Release Planning',
    ],
    mcqTypes: [
      'architecture_trade_offs',
      'debugging_judgment',
      'incident_response',
    ],
    longWorkTypes: ['code_review', 'debugging_judgment', 'system_design'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'system_design', 'debugging_judgment'],
  },
  {
    code: 'DEV',
    role: 'DevOps Engineer',
    family: 'Engineering',
    track: 'cloud_devops',
    competencies: [
      'CI/CD',
      'Observability',
      'Incident Response',
      'Infrastructure Cost',
      'Security Hardening',
      'Release Automation',
    ],
    mcqTypes: [
      'architecture_trade_offs',
      'debugging_judgment',
      'incident_response',
    ],
    longWorkTypes: ['code_review', 'debugging_judgment', 'system_design'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'system_design', 'debugging_judgment'],
  },
  {
    code: 'DTE',
    role: 'Data Engineer',
    family: 'Engineering',
    track: 'data_engineer',
    competencies: [
      'Pipeline Reliability',
      'Data Quality',
      'Schema Evolution',
      'Cost Optimisation',
      'SLA Management',
      'Incident Response',
    ],
    mcqTypes: [
      'architecture_trade_offs',
      'debugging_judgment',
      'incident_response',
    ],
    longWorkTypes: ['code_review', 'debugging_judgment', 'system_design'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'system_design', 'debugging_judgment'],
  },
  {
    code: 'QAE',
    role: 'QA Engineer',
    family: 'Engineering',
    track: 'quality_assurance',
    competencies: [
      'Test Strategy',
      'Release Risk',
      'Automation Trade-offs',
      'Defect Triage',
      'Regression Planning',
      'Stakeholder Sign-off',
    ],
    mcqTypes: [
      'architecture_trade_offs',
      'debugging_judgment',
      'incident_response',
    ],
    longWorkTypes: ['code_review', 'debugging_judgment', 'system_design'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'system_design', 'debugging_judgment'],
  },
  {
    code: 'MLE',
    role: 'ML Engineer',
    family: 'Engineering',
    track: 'ml_engineer',
    competencies: [
      'Model Deployment',
      'Data Drift',
      'Evaluation Design',
      'Production Monitoring',
      'Experimentation',
      'Stakeholder Alignment',
    ],
    mcqTypes: [
      'architecture_trade_offs',
      'debugging_judgment',
      'incident_response',
    ],
    longWorkTypes: ['code_review', 'debugging_judgment', 'system_design'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'system_design', 'debugging_judgment'],
  },
  {
    code: 'CYB',
    role: 'Cybersecurity Engineer',
    family: 'Engineering',
    track: 'cybersecurity',
    competencies: [
      'Threat Response',
      'Access Control',
      'Vulnerability Management',
      'Compliance',
      'Incident Containment',
      'Risk Communication',
    ],
    mcqTypes: [
      'architecture_trade_offs',
      'debugging_judgment',
      'incident_response',
    ],
    longWorkTypes: ['code_review', 'debugging_judgment', 'system_design'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'system_design', 'debugging_judgment'],
  },
  {
    code: 'PMG',
    role: 'Product Manager',
    family: 'Product',
    track: 'product_manager',
    competencies: [
      'Prioritisation',
      'Stakeholder Management',
      'Roadmap Planning',
      'Metrics',
      'Discovery',
      'Launch Planning',
    ],
    mcqTypes: [
      'prioritisation_case',
      'stakeholder_conflict',
      'metric_judgment',
    ],
    longWorkTypes: ['product_critique', 'prioritisation_case'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: [
      'scenario_reasoning',
      'prioritisation_case',
      'stakeholder_conflict',
    ],
  },
  {
    code: 'PDG',
    role: 'Product Designer',
    family: 'Design',
    track: 'product_designer',
    competencies: [
      'User Research',
      'Accessibility',
      'Design Systems',
      'Stakeholder Feedback',
      'Usability',
      'Handoff Quality',
    ],
    mcqTypes: [
      'design_critique',
      'accessibility_trade_offs',
      'stakeholder_pushback',
    ],
    longWorkTypes: ['design_critique', 'process_walkthrough'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: [
      'scenario_reasoning',
      'stakeholder_conflict',
      'design_critique',
    ],
  },
  {
    code: 'UXR',
    role: 'UX Researcher',
    family: 'Design',
    track: 'ux_researcher',
    competencies: [
      'Research Design',
      'Stakeholder Influence',
      'Synthesis',
      'Recruitment',
      'Insight Communication',
      'Ethics',
    ],
    mcqTypes: [
      'design_critique',
      'accessibility_trade_offs',
      'stakeholder_pushback',
    ],
    longWorkTypes: ['design_critique', 'process_walkthrough'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: [
      'scenario_reasoning',
      'stakeholder_conflict',
      'design_critique',
    ],
  },
  {
    code: 'BRD',
    role: 'Brand Designer',
    family: 'Design',
    track: 'brand_designer',
    competencies: [
      'Brand Consistency',
      'Client Management',
      'Visual Systems',
      'Campaign Design',
      'Guidelines',
      'Stakeholder Feedback',
    ],
    mcqTypes: [
      'design_critique',
      'accessibility_trade_offs',
      'stakeholder_pushback',
    ],
    longWorkTypes: ['design_critique', 'process_walkthrough'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: [
      'scenario_reasoning',
      'stakeholder_conflict',
      'design_critique',
    ],
  },
  {
    code: 'GRM',
    role: 'Growth Marketer',
    family: 'Marketing',
    track: 'marketing',
    competencies: [
      'Channel Strategy',
      'CAC Optimisation',
      'Referral Growth',
      'Experimentation',
      'Budget Allocation',
      'Funnel Analysis',
    ],
    mcqTypes: ['channel_trade_offs', 'budget_judgment', 'data_interpretation'],
    longWorkTypes: ['campaign_case', 'data_interpretation'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'campaign_case', 'stakeholder_conflict'],
  },
  {
    code: 'CTM',
    role: 'Content Marketer',
    family: 'Marketing',
    track: 'marketing',
    competencies: [
      'Content Strategy',
      'SEO',
      'Editorial Planning',
      'Brand Voice',
      'Performance Tracking',
      'Stakeholder Alignment',
    ],
    mcqTypes: ['channel_trade_offs', 'budget_judgment', 'data_interpretation'],
    longWorkTypes: ['campaign_case', 'data_interpretation'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'campaign_case', 'stakeholder_conflict'],
  },
  {
    code: 'SMM',
    role: 'Social Media Manager',
    family: 'Marketing',
    track: 'marketing',
    competencies: [
      'Community Management',
      'Crisis Response',
      'Content Calendar',
      'Influencer Relations',
      'Brand Safety',
      'Engagement Metrics',
    ],
    mcqTypes: ['channel_trade_offs', 'budget_judgment', 'data_interpretation'],
    longWorkTypes: ['campaign_case', 'data_interpretation'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'campaign_case', 'stakeholder_conflict'],
  },
  {
    code: 'PFM',
    role: 'Performance Marketer',
    family: 'Marketing',
    track: 'marketing',
    competencies: [
      'ROAS Optimisation',
      'Attribution',
      'Budget Pacing',
      'Creative Testing',
      'Channel Mix',
      'Client Reporting',
    ],
    mcqTypes: ['channel_trade_offs', 'budget_judgment', 'data_interpretation'],
    longWorkTypes: ['campaign_case', 'data_interpretation'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'campaign_case', 'stakeholder_conflict'],
  },
  {
    code: 'DTA',
    role: 'Data Analyst',
    family: 'Data',
    track: 'data_analyst',
    competencies: [
      'Data Quality',
      'Stakeholder Communication',
      'Analysis Scope',
      'Metric Definition',
      'Visualisation',
      'Methodology',
    ],
    mcqTypes: [
      'methodology_trade_offs',
      'stakeholder_communication',
      'data_interpretation',
    ],
    longWorkTypes: ['data_interpretation', 'analysis_case'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'stakeholder_conflict', 'analysis_case'],
  },
  {
    code: 'BIA',
    role: 'Business Analyst',
    family: 'Data',
    track: 'business_analyst',
    competencies: [
      'Requirements Clarity',
      'Scope Management',
      'Process Analysis',
      'Stakeholder Facilitation',
      'MVP Definition',
      'Change Impact',
    ],
    mcqTypes: [
      'methodology_trade_offs',
      'stakeholder_communication',
      'data_interpretation',
    ],
    longWorkTypes: ['data_interpretation', 'analysis_case'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'stakeholder_conflict', 'analysis_case'],
  },
  {
    code: 'BID',
    role: 'BI Developer',
    family: 'Data',
    track: 'bi_developer',
    competencies: [
      'Dashboard Accuracy',
      'Data Modelling',
      'Self-Service Enablement',
      'Performance',
      'Governance',
      'Stakeholder Support',
    ],
    mcqTypes: [
      'methodology_trade_offs',
      'stakeholder_communication',
      'data_interpretation',
    ],
    longWorkTypes: ['data_interpretation', 'analysis_case'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'stakeholder_conflict', 'analysis_case'],
  },
  {
    code: 'DSC',
    role: 'Data Scientist',
    family: 'Data',
    track: 'data_scientist',
    competencies: [
      'Model Selection',
      'Bias Detection',
      'Experiment Design',
      'Stakeholder Communication',
      'Production Readiness',
      'Statistical Rigor',
    ],
    mcqTypes: [
      'methodology_trade_offs',
      'stakeholder_communication',
      'data_interpretation',
    ],
    longWorkTypes: ['data_interpretation', 'analysis_case'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'stakeholder_conflict', 'analysis_case'],
  },
  {
    code: 'OPM',
    role: 'Operations Manager',
    family: 'Operations',
    track: 'operations_manager',
    competencies: [
      'Process Efficiency',
      'Vendor Management',
      'Team Capacity',
      'Compliance',
      'Escalation',
      'Cost Control',
    ],
    mcqTypes: [
      'escalation_judgment',
      'process_trade_offs',
      'prioritisation_case',
    ],
    longWorkTypes: ['process_design', 'prioritisation_case'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'stakeholder_conflict', 'process_design'],
  },
  {
    code: 'CSM',
    role: 'Customer Success Manager',
    family: 'Operations',
    track: 'customer_success',
    competencies: [
      'Churn Prevention',
      'Account Management',
      'Escalation',
      'Renewal Strategy',
      'Product Adoption',
      'Executive Relationships',
    ],
    mcqTypes: [
      'escalation_judgment',
      'process_trade_offs',
      'prioritisation_case',
    ],
    longWorkTypes: ['process_design', 'prioritisation_case'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'stakeholder_conflict', 'process_design'],
  },
  {
    code: 'PJM',
    role: 'Project Manager',
    family: 'Operations',
    track: 'project_manager',
    competencies: [
      'Scope Control',
      'Risk Management',
      'Stakeholder Communication',
      'Resource Planning',
      'Dependency Management',
      'Delivery Recovery',
    ],
    mcqTypes: [
      'escalation_judgment',
      'process_trade_offs',
      'prioritisation_case',
    ],
    longWorkTypes: ['process_design', 'prioritisation_case'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'stakeholder_conflict', 'process_design'],
  },
  {
    code: 'HRO',
    role: 'HR / People Ops',
    family: 'Operations',
    track: 'hr_people_ops',
    competencies: [
      'Performance Management',
      'Policy Design',
      'Conflict Resolution',
      'Compensation Equity',
      'Hiring Process',
      'Compliance',
    ],
    mcqTypes: [
      'escalation_judgment',
      'process_trade_offs',
      'prioritisation_case',
    ],
    longWorkTypes: ['process_design', 'prioritisation_case'],
    longScenarioTypes: ['scenario_reasoning'],
    openTypes: ['scenario_reasoning', 'stakeholder_conflict', 'process_design'],
  },
];

type SourceQuestion = Record<string, unknown>;

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length];
}

function assertMinimums(): void {
  if (SET.mcq < RUNTIME_MIN.mcq) throw new Error('mcq below runtime minimum');
  if (SET.open < RUNTIME_MIN.shortText)
    throw new Error('open below runtime minimum');
  if (SET.lt1 < RUNTIME_MIN.lt1) throw new Error('lt1 below runtime minimum');
  if (SET.lt2 < RUNTIME_MIN.lt2) throw new Error('lt2 below runtime minimum');
}

function levelPrefix(level: Level): string {
  if (level === 'mid') return 'As a mid-level professional, ';
  if (level === 'senior') return 'As a senior leader, ';
  if (level === 'expert') return 'As a principal expert, ';
  return '';
}

function difficulty(level: Level, index: number, org: boolean): number {
  const base = { junior: 6, mid: 7, senior: 8, expert: 9 }[level];
  return Math.min(10, base + (index % 2) + (org ? 1 : 0));
}

function inferSignals(
  role: RoleMeta,
  questionType: string,
  scenarioHint: string,
): {
  focus: string;
  strong: readonly [string, string, string];
  weak: readonly [string, string, string];
  score4: string;
  score3: string;
  score2: string;
  score1: string;
} {
  const type = questionType.toLowerCase();
  const text = scenarioHint.toLowerCase();

  if (
    role.family === 'Engineering' &&
    (type.includes('scenario') ||
      type.includes('debugging') ||
      type.includes('system_design'))
  ) {
    return {
      focus:
        'How the candidate diagnoses the technical issue, narrows the likely root cause, and makes a practical delivery decision under pressure.',
      strong: [
        'Separates diagnosis from fixing and names the most likely failure points first',
        'Prioritises user impact and chooses the smallest safe stabilisation path',
        'Makes a clear ship, rollback, scope-cut, or sequencing decision and communicates it',
      ],
      weak: [
        'Jumps straight into code changes without narrowing the likely cause',
        'Treats the situation as purely technical with no delivery or stakeholder decision',
        'Offers generic engineering best practices with no concrete triage path',
      ],
      score4:
        'Identifies the likely failure points, sequences diagnosis and mitigation, and makes a clear technical and delivery call.',
      score3:
        'Strong technical reasoning but weaker on communication or delivery trade-offs.',
      score2:
        'Recognises the engineering issue but responds with vague debugging or architecture advice.',
      score1:
        'Generic technical commentary with no concrete diagnosis path, prioritisation, or ownership.',
    };
  }

  if (
    role.family === 'Product' &&
    (type.includes('scenario') || type.includes('stakeholder'))
  ) {
    return {
      focus:
        'How the candidate frames a product decision, aligns competing stakeholders, and protects the most important business outcome.',
      strong: [
        'Clarifies the real product or business constraint before promising scope or timing',
        'Balances user, revenue, delivery, and stakeholder pressure instead of optimising for one voice',
        'Turns the situation into a concrete recommendation with sequencing, trade-offs, and owners',
      ],
      weak: [
        'Defaults to the loudest stakeholder instead of naming the core decision',
        'Avoids the trade-off by promising more than the team can realistically deliver',
        'Talks in product strategy platitudes without making a concrete call',
      ],
      score4:
        'Frames the decision clearly, makes the trade-off explicit, and aligns stakeholders around a credible next step.',
      score3:
        'Good product judgment, but one major business or stakeholder implication is underdeveloped.',
      score2:
        'Sees the tension but stays vague about the actual recommendation or sequencing.',
      score1:
        'Avoids the product decision or overcommits to satisfy stakeholders.',
    };
  }

  if (role.family === 'Design' && type.includes('scenario')) {
    return {
      focus:
        'How the candidate protects user outcomes with evidence while navigating stakeholder pressure and practical delivery constraints.',
      strong: [
        'Reframes the situation around user impact, evidence, or accessibility rather than personal preference',
        'Explains the design trade-off clearly in terms stakeholders can act on',
        'Offers a practical next step such as a compromise, test, or phased path',
      ],
      weak: [
        'Treats the issue as taste-based disagreement instead of evidence-based trade-off',
        'Complies immediately without surfacing usability or accessibility consequences',
        'Pushes back emotionally without a practical path forward',
      ],
      score4:
        'Uses evidence well, explains the trade-off clearly, and proposes a practical path that protects user outcomes.',
      score3:
        'Defends the work well but the practical compromise or implementation path is weaker.',
      score2:
        'Recognises the design tension but responds too passively or too confrontationally.',
      score1:
        'Frames the issue as opinion only and fails to protect the user outcome.',
    };
  }

  if (role.family === 'Marketing' && type.includes('scenario')) {
    return {
      focus:
        'How the candidate interprets the growth problem, prioritises the most leveraged moves, and makes explicit trade-offs under budget or channel pressure.',
      strong: [
        'Identifies the most important metric or bottleneck instead of listing every possible tactic',
        'Prioritises channels or interventions based on likely impact, economics, and constraints',
        'States the trade-offs between short-term recovery and longer-term growth clearly',
      ],
      weak: [
        'Lists tactics without prioritisation, economics, or expected impact',
        'Suggests more spend or more channels without respecting the stated constraints',
        'Optimises a vanity metric instead of the outcome that matters in the scenario',
      ],
      score4:
        'Interprets the growth problem correctly, prioritises the highest-leverage actions, and makes the trade-offs explicit.',
      score3:
        'Strong channel or growth reasoning, but one economic or sequencing dimension is underdeveloped.',
      score2:
        'Understands the pressure but responds with broad tactics rather than a structured plan.',
      score1:
        'Generic marketing advice disconnected from the actual growth or budget problem.',
    };
  }

  if (role.family === 'Data' && type.includes('scenario')) {
    return {
      focus:
        'How the candidate protects analytical integrity, clarifies uncertainty, and keeps stakeholder decisions grounded in defensible evidence.',
      strong: [
        'Clarifies what is known, what is uncertain, and what claim can be defended right now',
        'Narrows disagreement to methodology, definitions, freshness, or assumptions instead of arguing abstractly',
        'Creates a path to alignment that protects both decision quality and stakeholder trust',
      ],
      weak: [
        'Capitulates immediately or offers to recheck everything to avoid the conflict',
        'Argues defensively without isolating the disputed method or definition',
        'Presents conclusions with false certainty despite obvious uncertainty or conflict',
      ],
      score4:
        'Protects analytical integrity, narrows the dispute clearly, and guides stakeholders toward a defensible decision.',
      score3:
        'Handles the challenge well but the follow-up alignment path or decision framing is less complete.',
      score2:
        'Recognises the data issue but responds with vague caution or reactive debate.',
      score1:
        'Either collapses under pressure or overstates certainty without addressing the analytical problem.',
    };
  }

  if (role.family === 'Product' && type.includes('prioritisation')) {
    return {
      focus:
        'How the candidate sequences competing product demands, protects the most important risk first, and resets stakeholder expectations credibly.',
      strong: [
        'Clarifies what must be addressed first and why it outranks the other requests',
        'Balances customer, security, revenue, or delivery risk instead of optimizing for one stakeholder only',
        'Turns the trade-off into a concrete sequence with owners, timing, or decision gates',
      ],
      weak: [
        'Treats all incoming requests as equally urgent or tries to move everything at once',
        'Optimises for the loudest stakeholder without defining the real business risk',
        'Avoids a sequencing call by promising more than the team can realistically deliver',
      ],
      score4:
        'Makes the prioritisation logic explicit, sequences the work cleanly, and resets expectations with a credible plan.',
      score3:
        'Good prioritisation instincts, but one major trade-off or stakeholder implication is underdeveloped.',
      score2:
        'Recognises the conflict but stays too vague about sequencing or rationale.',
      score1:
        'Avoids the prioritisation call or overcommits to satisfy everyone.',
    };
  }

  if (
    role.family === 'Design' &&
    (type.includes('design_critique') || type.includes('stakeholder'))
  ) {
    return {
      focus:
        'How the candidate defends design choices with evidence while preserving trust and offering a workable path forward.',
      strong: [
        'Acknowledges the stakeholder concern before reframing the decision with design or user evidence',
        'Explains the likely impact on usability, accessibility, trust, or completion instead of arguing from taste',
        'Offers a concrete alternative, test, or compromise rather than only resisting the request',
      ],
      weak: [
        'Frames the issue as taste versus taste instead of evidence versus trade-off',
        'Complies immediately without surfacing user or accessibility consequences',
        'Pushes back emotionally without a practical next step',
      ],
      score4:
        'Validates the concern, uses evidence well, and proposes a practical next step that protects user outcomes.',
      score3:
        'Defends the work effectively but the alternative path or compromise is not fully developed.',
      score2:
        'Recognises the tension but responds too passively or too confrontationally.',
      score1:
        'Treats the conflict as opinion only and fails to protect user outcomes.',
    };
  }

  if (
    role.family === 'Marketing' &&
    (type.includes('campaign') || type.includes('data_interpretation'))
  ) {
    return {
      focus:
        'How the candidate reasons about growth levers, economics, and channel trade-offs instead of listing disconnected tactics.',
      strong: [
        'Questions unrealistic goals or misleading headline metrics instead of accepting them at face value',
        'Prioritises channels or interventions based on economics, constraints, and likely impact',
        'Explains explicit trade-offs between short-term efficiency and long-term growth',
      ],
      weak: [
        'Lists tactics without prioritisation, math, or expected impact',
        'Suggests more spend despite explicit budget constraints',
        'Optimises a vanity metric while ignoring conversion quality or economics',
      ],
      score4:
        'Interprets the numbers correctly, prioritises the most leveraged actions, and states the core trade-offs clearly.',
      score3:
        'Shows solid growth thinking but misses one key economic or prioritisation dimension.',
      score2:
        'Identifies useful actions but lacks economic rigor or sequencing.',
      score1:
        'Offers generic marketing advice disconnected from the scenario numbers.',
    };
  }

  if (
    role.family === 'Data' &&
    (type.includes('analysis') ||
      type.includes('data_interpretation') ||
      type.includes('stakeholder'))
  ) {
    return {
      focus:
        'How the candidate handles analytical uncertainty, metric integrity, and stakeholder pressure without overclaiming or collapsing under challenge.',
      strong: [
        'Clarifies what is known, what is disputed, and what can be defended right now',
        'Narrows the disagreement to methodology, definitions, or data freshness instead of arguing abstractly',
        'Creates a path to alignment that protects decision quality and stakeholder trust',
      ],
      weak: [
        'Capitulates immediately or says they will recheck everything to avoid conflict',
        'Argues defensively without narrowing the disputed assumption or method',
        'Presents conclusions with false certainty despite obvious limitations',
      ],
      score4:
        'Protects analytical integrity, narrows the disagreement clearly, and moves the group toward a defensible decision.',
      score3:
        'Handles the challenge well but leaves the follow-up alignment path underdeveloped.',
      score2:
        'Understands the data issue but gets pulled into vague debate or over-caution.',
      score1:
        'Either collapses under pressure or overstates certainty without addressing the real analytical problem.',
    };
  }

  if (role.family === 'Operations' && type.includes('process_design')) {
    return {
      focus:
        'How the candidate stabilises a live operational problem, chooses the right immediate intervention, and protects service outcomes under pressure.',
      strong: [
        'Identifies the immediate operational constraint before proposing broad process changes',
        'Makes a concrete short-term stabilization plan with owners, sequencing, or triage rules',
        'Balances service quality, team capacity, and stakeholder expectations explicitly',
      ],
      weak: [
        'Jumps straight to long-term redesign without stabilising the live issue first',
        'Ignores team capacity or operational reality while proposing ideal-state fixes',
        'Responds with generic coordination language instead of a concrete operating plan',
      ],
      score4:
        'Stabilises the immediate issue, assigns practical next steps, and makes the operational trade-offs explicit.',
      score3:
        'Strong triage and sequencing, but one capacity or stakeholder dimension remains vague.',
      score2:
        'Recognises the operational stress but responds too generally or reactively.',
      score1:
        'Treats the issue as generic pressure without a clear operating response.',
    };
  }

  if (role.family === 'Operations' && type.includes('prioritisation')) {
    return {
      focus:
        'How the candidate prioritises constrained operational work and makes a credible trade-off between competing business needs.',
      strong: [
        'Clarifies the real operational constraint before deciding what moves first',
        'Makes the cut line explicit instead of treating all escalations as equal',
        'Explains the service, customer, or execution trade-off created by the call',
      ],
      weak: [
        'Accepts every operational demand simultaneously without sequencing',
        'Optimises for convenience instead of business or customer impact',
        'Escalates upward without presenting a decision frame or options',
      ],
      score4:
        'Makes the trade-off explicit, sequences the work clearly, and protects the most important service outcome.',
      score3:
        'Good prioritisation logic but one key operational implication or stakeholder consequence is underdeveloped.',
      score2:
        'Sees the conflict but stays vague about what actually moves first and why.',
      score1:
        'Avoids the prioritisation decision or overcommits the operation.',
    };
  }

  if (role.family === 'Operations' && role.code === 'HRO') {
    return {
      focus:
        'How the candidate balances fairness, process integrity, and business continuity in a sensitive people issue.',
      strong: [
        'Protects immediate people risk and process fairness at the same time',
        'Separates facts, confidentiality, and business continuity instead of collapsing them together',
        'Creates a concrete next-step plan for investigation, support, and stakeholder communication',
      ],
      weak: [
        'Optimises only for delivery continuity while minimising people or policy risk',
        'Acts informally on a sensitive issue without defining process or confidentiality boundaries',
        'Delays action because the case is politically sensitive or uncomfortable',
      ],
      score4:
        'Protects people, process, and business continuity with clear sequencing and mature judgment.',
      score3:
        'Shows sound people judgment but leaves one process or communication risk unclear.',
      score2:
        'Understands the sensitivity but lacks a disciplined response structure.',
      score1:
        'Responds casually, politically, or defensively to a sensitive people issue.',
    };
  }

  if (role.family === 'Operations' && type.includes('scenario')) {
    return {
      focus:
        'How the candidate stabilises a live service or operational problem, chooses the right immediate intervention, and keeps stakeholders aligned under pressure.',
      strong: [
        'Identifies the immediate service or process constraint before proposing broad changes',
        'Makes a concrete short-term triage or stabilisation plan with clear sequencing',
        'Explains the trade-off between service quality, team capacity, customer impact, or speed',
      ],
      weak: [
        'Jumps straight to long-term redesign without stabilising the live issue first',
        'Ignores operational constraints such as staffing, SLA, backlog, or customer impact',
        'Responds with generic coordination language instead of a practical operating plan',
      ],
      score4:
        'Stabilises the immediate issue, assigns practical next steps, and makes the operational trade-offs explicit.',
      score3:
        'Strong triage logic, but one capacity, service, or stakeholder dimension is underdeveloped.',
      score2:
        'Recognises the operational stress but responds too generally or reactively.',
      score1:
        'Treats the issue as generic pressure without a concrete operating response.',
    };
  }

  if (role.family === 'Engineering' && type.includes('code_review')) {
    return {
      focus:
        'How the candidate evaluates a risky implementation and defines the smallest safe path to ship or refactor.',
      strong: [
        'Identifies the highest-risk implementation flaw before proposing broader cleanup',
        'Explains what to patch now versus what to defer deliberately',
        'Connects the technical choice to user impact, reliability, or release risk',
      ],
      weak: [
        'Treats the review as style feedback instead of identifying the real risk',
        'Proposes a full rewrite without regard for urgency or delivery pressure',
        'Gives generic code quality advice with no concrete mitigation path',
      ],
      score4:
        'Finds the highest-risk flaw, proposes the smallest safe fix, and explains the delivery trade-off clearly.',
      score3:
        'Good technical judgment, but the release or user-risk framing is underdeveloped.',
      score2:
        'Spots issues but responds with broad refactor language rather than a concrete safe plan.',
      score1:
        'Misses the real implementation risk or responds with generic code-review clichés.',
    };
  }

  const rules = [
    {
      test: /(load time|latency|timeout|slow|render|performance|p99|bundle|cold start)/,
      value: {
        focus:
          'How the candidate diagnoses performance impact, narrows likely causes, and makes a ship-vs-fix decision under pressure.',
        strong: [
          'Separates diagnosis from fixing and names the most likely performance bottlenecks first',
          'Prioritises the highest user-impact path instead of trying to optimise everything at once',
          'Makes a clear ship, rollback, or scope-cut decision and communicates it to stakeholders',
        ],
        weak: [
          'Jumps straight into code changes without narrowing the likely bottleneck',
          'Treats the issue as purely technical with no product or launch decision',
          'Offers generic “optimise performance” advice with no prioritisation',
        ],
        score4:
          'Identifies likely bottlenecks, sequences diagnosis and mitigation, and makes a clear delivery decision with stakeholder communication.',
        score3:
          'Good technical instincts and triage, but the business or communication call is underdeveloped.',
        score2:
          'Recognises the performance issue but responds with vague optimisation ideas rather than a decision framework.',
        score1:
          'Generic performance advice with no concrete diagnosis path or ownership.',
      },
    },
    {
      test: /(breach|credential|phishing|ransomware|vulnerability|iam|waf|security|malware|exfiltrat|tls)/,
      value: {
        focus:
          'How the candidate contains security risk quickly while preserving evidence, communication, and business continuity.',
        strong: [
          'Prioritises containment and scope assessment before long-term remediation',
          'Balances technical response with legal, compliance, or customer communication needs',
          'Makes a clear decision on escalation, access control, or service continuity',
        ],
        weak: [
          'Treats the issue like a routine bug fix instead of an incident with exposure risk',
          'Ignores evidence preservation, auditability, or stakeholder escalation',
          'Offers blanket shutdown or denial without assessing blast radius',
        ],
        score4:
          'Contains risk fast, scopes exposure, and coordinates technical and stakeholder response without losing control of the incident.',
        score3:
          'Strong containment plan but weaker on cross-functional communication or evidence handling.',
        score2:
          'Understands the security issue but lacks a structured incident response sequence.',
        score1:
          'Responds casually, defensively, or without containment discipline.',
      },
    },
    {
      test: /(renewal|client|customer|account|churn|enterprise|sales promised|champion left)/,
      value: {
        focus:
          'How the candidate protects a customer relationship without making delivery promises the team cannot keep.',
        strong: [
          'Uses evidence or usage context before making a commercial or delivery promise',
          'Creates a concrete recovery path with the right internal and external stakeholders',
          'Balances relationship protection with honest scope or timeline negotiation',
        ],
        weak: [
          'Promises dates, discounts, or custom work before validating internal feasibility',
          'Treats the situation as a relationship problem only and ignores product or delivery constraints',
          'Avoids the conversation instead of creating a recovery plan',
        ],
        score4:
          'Stabilises the account with data, targeted escalation, and a credible plan that avoids over-commitment.',
        score3:
          'Protects the relationship well but leaves delivery feasibility or ownership vague.',
        score2:
          'Shows empathy or urgency but not a structured account or stakeholder strategy.',
        score1:
          'Defaults to appeasing the customer or delaying action with no credible plan.',
      },
    },
    {
      test: /(seo|cac|roas|referral|attribution|campaign|sign-ups|cpc|channel|organic|meta)/,
      value: {
        focus:
          'How the candidate reasons about growth levers, unit economics, and trade-offs instead of listing tactics.',
        strong: [
          'Challenges unrealistic targets or misleading headline metrics instead of accepting them at face value',
          'Prioritises channels or interventions based on economics, constraints, and likely impact',
          'Explains explicit trade-offs between short-term efficiency and long-term growth',
        ],
        weak: [
          'Lists tactics without prioritisation, math, or expected impact',
          'Suggests more spend despite stated budget constraints',
          'Optimises a vanity metric while ignoring conversion quality or economics',
        ],
        score4:
          'Interprets the numbers correctly, prioritises the most leveraged actions, and states the core trade-offs clearly.',
        score3:
          'Shows solid channel thinking but misses one key economic or prioritisation dimension.',
        score2:
          'Identifies some useful actions but lacks economic rigor or sequencing.',
        score1:
          'Offers generic marketing tactics disconnected from the scenario numbers.',
      },
    },
    {
      test: /(analysis|dashboard|metric|warehouse|data|sample size|retention|methodology|finance reports|active user)/,
      value: {
        focus:
          'How the candidate handles analytical uncertainty, metric integrity, and stakeholder pressure without overclaiming.',
        strong: [
          'Clarifies what is known, what is uncertain, and what can be defended right now',
          'Narrows the disagreement to data definition, methodology, or freshness instead of arguing abstractly',
          'Proposes a path to alignment that protects decision quality and stakeholder trust',
        ],
        weak: [
          'Capitulates immediately or says they will recheck everything to avoid the conflict',
          'Argues defensively without narrowing the disputed assumption or method',
          'Presents conclusions with false certainty despite data limitations',
        ],
        score4:
          'Protects analytical integrity, narrows the disagreement clearly, and moves the group toward a defensible decision.',
        score3:
          'Handles the disagreement well but leaves the follow-up alignment path or decision frame underdeveloped.',
        score2:
          'Understands the data issue but gets pulled into vague debate or over-caution.',
        score1:
          'Either collapses under pressure or overstates certainty without addressing the real data problem.',
      },
    },
    {
      test: /(research|testing|usability|design|accessibility|premium|prototype|onboarding flow)/,
      value: {
        focus:
          'How the candidate defends user-centered decisions with evidence while managing senior stakeholder pressure.',
        strong: [
          'Acknowledges the stakeholder concern before reframing the decision with user or accessibility evidence',
          'Explains the likely impact on completion, trust, or usability rather than relying on personal taste',
          'Offers a concrete compromise, test, or alternative path instead of blunt rejection',
        ],
        weak: [
          'Complies immediately without surfacing evidence or downstream risk',
          'Frames the conversation as taste versus taste instead of evidence versus trade-off',
          'Pushes back emotionally without giving a workable next step',
        ],
        score4:
          'Validates the concern, uses evidence well, and proposes a practical next step that protects user outcomes.',
        score3:
          'Defends the work effectively but lacks a strong compromise or execution path.',
        score2:
          'Recognises the trade-off but responds too passively or too confrontationally.',
        score1:
          'Treats the issue as opinion only and does not protect user outcomes.',
      },
    },
    {
      test: /(scope|roadmap|launch|dependency|timeline|go-live|vendor|sprint|board|steering)/,
      value: {
        focus:
          'How the candidate regains clarity on scope, sequencing, and stakeholder expectations under delivery pressure.',
        strong: [
          'Clarifies the real constraint or critical path before renegotiating scope or dates',
          'Sequences decisions and owners instead of treating every item as equally urgent',
          'Makes a transparent trade-off between speed, scope, and risk and communicates it upward',
        ],
        weak: [
          'Accepts all requests simultaneously without establishing a cut line',
          'Jumps to a new timeline without understanding the real dependency',
          'Escalates the problem upward without offering a decision frame or options',
        ],
        score4:
          'Finds the true constraint, makes the cut-line explicit, and resets expectations with clear ownership.',
        score3:
          'Good sequencing and communication, but the critical-path or trade-off logic is incomplete.',
        score2:
          'Understands there is a planning problem but responds with vague coordination language.',
        score1:
          'Treats the issue as generic project stress without a concrete decision path.',
      },
    },
    {
      test: /(manager|attrition|grievance|compensation|policy|team unsafe|calibration|people ops|hr)/,
      value: {
        focus:
          'How the candidate balances fairness, process integrity, and business continuity in a sensitive people issue.',
        strong: [
          'Protects process fairness and immediate people risk at the same time',
          'Separates facts, confidentiality, and business continuity instead of collapsing them together',
          'Creates a concrete next-step plan for investigation, support, and stakeholder communication',
        ],
        weak: [
          'Optimises only for delivery continuity while minimising people or policy risk',
          'Acts informally on a sensitive issue without defining process or confidentiality boundaries',
          'Delays action because the case is uncomfortable or politically sensitive',
        ],
        score4:
          'Protects people, process, and business continuity with clear sequencing and sound judgment.',
        score3:
          'Shows mature people judgment but leaves one process or communication risk unclear.',
        score2:
          'Understands the sensitivity but lacks a disciplined response structure.',
        score1:
          'Responds casually, politically, or defensively to a sensitive people issue.',
      },
    },
  ] as const;

  for (const rule of rules) {
    if (rule.test.test(text)) {
      return rule.value;
    }
  }

  return {
    focus:
      'How the candidate structures a practical response, makes trade-offs explicit, and keeps stakeholders aligned under pressure.',
    strong: [
      'Identifies the immediate constraint before proposing actions',
      'Sequences concrete next steps with clear ownership or decision points',
      'Explains the trade-offs rather than offering generic best practices',
    ],
    weak: [
      'Offers generic advice that could fit any scenario',
      'Ignores the delivery, stakeholder, or business consequences',
      'Responds with theory rather than a practical next-step plan',
    ],
    score4:
      'Gives a concrete, well-sequenced response that matches the stakes and makes trade-offs explicit.',
    score3:
      'Solid practical response but misses one major decision, stakeholder, or risk dimension.',
    score2: 'Partially relevant but too vague, reactive, or theoretical.',
    score1:
      'Off-topic, purely definitional, or disconnected from the scenario.',
  };
}

function rubric(
  role: RoleMeta,
  questionType: string,
  competency: string,
  format: Format,
  level: Level,
  org: boolean,
  scenarioHint: string,
): Record<string, unknown> {
  const signals = inferSignals(role, questionType, scenarioHint);
  const seniorOpen =
    format === 'open_ended_scenario' &&
    (level === 'senior' || level === 'expert');
  const strong = seniorOpen
    ? [
        signals.strong[0],
        signals.strong[1],
        signals.strong[2],
        org
          ? 'Connects the decision to org-level or revenue impact'
          : 'States trade-offs instead of generic advice',
      ]
    : [signals.strong[0], signals.strong[1], signals.strong[2]];

  return {
    what_to_evaluate: signals.focus,
    strong_answer_must_show: strong,
    weak_answer_indicators: [signals.weak[0], signals.weak[1], signals.weak[2]],
    score_guide: {
      '4': signals.score4,
      '3': signals.score3,
      '2': signals.score2,
      '1': signals.score1,
    },
  };
}

function mcqOptions(index: number): {
  options: Record<string, string>;
  answer: 'A' | 'B' | 'C' | 'D';
} {
  const correct = [
    'Stabilise impact first, communicate an evidence-based timeline, renegotiate scope with stakeholders',
    'Protect users or customers, ship the smallest safe fix, document residual risk with owners',
    'Align facts across teams, decide with explicit trade-offs, assign clear owners before promising dates',
    'Pause non-essential work, time-box diagnosis, escalate with options not open-ended problems',
    'Validate assumptions with data, narrow the decision, propose a reversible next step',
  ];
  const wrong = [
    [
      'Commit publicly to the original date while the team works overtime',
      'Wait for perfect information before any update',
      'Split the team across all requests with no priority order',
    ],
    [
      'Hide the issue from external stakeholders',
      'Blame another team in writing to leadership',
      'Accept scope creep without a timeline change',
    ],
    [
      'Prioritise the loudest stakeholder by default',
      'Optimise for the easiest task not highest impact',
      'Defer all decisions to next quarter',
    ],
  ];
  const w = wrong[index % wrong.length];
  return {
    options: { A: pick(correct, index), B: w[0], C: w[1], D: w[2] },
    answer: 'A',
  };
}

function scenariosFor(roleCode: string): RoleScenarioBank {
  const bank = ROLE_SCENARIOS[roleCode];
  if (!bank) throw new Error(`Missing scenario bank for ${roleCode}`);
  return bank;
}

function buildMcq(
  role: RoleMeta,
  level: Level,
  index: number,
  bank: RoleScenarioBank,
): SourceQuestion {
  const industry = pick(INDUSTRIES, index);
  const competency = pick(role.competencies, index);
  const stem = pick(bank.mcq, index);
  const { options, answer } = mcqOptions(index);
  const org = (level === 'senior' || level === 'expert') && index < 15;
  const id = `${role.code}-${LEVEL_CODE[level]}-ADV-MCQ-${String(index + 1).padStart(3, '0')}`;

  return {
    id,
    role: role.role,
    role_code: role.code,
    role_family: role.family,
    level,
    assessment_stage: 'advanced_assessment',
    format: 'mcq',
    competency,
    question_type: pick(role.mcqTypes, index),
    industry,
    estimated_time_seconds: 45,
    question: `${levelPrefix(level)}${stem} Context: ${role.role} at a ${industry} company; competency focus: ${competency}. Which option best protects outcomes without over-committing the team?`,
    options,
    correct_answer: answer,
    grading_rubric: null,
    difficulty_score: difficulty(level, index, org),
    tags: [role.track, level, 'mcq', industry],
    anti_cheat_seed: 'variant_A',
    generated_by: GENERATED_BY,
    date_generated: new Date().toISOString().slice(0, 10),
  };
}

function buildOpen(
  role: RoleMeta,
  level: Level,
  index: number,
  bank: RoleScenarioBank,
): SourceQuestion {
  const industry = pick(INDUSTRIES, index + 1);
  const competency = pick(role.competencies, index + 2);
  const stem = pick(bank.open, index);
  const org = (level === 'senior' || level === 'expert') && index < 30;
  const id = `${role.code}-${LEVEL_CODE[level]}-ADV-OE-${String(index + 1).padStart(3, '0')}`;

  return {
    id,
    role: role.role,
    role_code: role.code,
    role_family: role.family,
    level,
    assessment_stage: 'advanced_assessment',
    format: 'open_ended_scenario',
    competency,
    question_type: pick(role.openTypes, index),
    industry,
    estimated_time_seconds: 120,
    question: `${levelPrefix(level)}${stem} Industry: ${industry}. Role: ${role.role}. Walk through your response with focus on ${competency.toLowerCase()}.`,
    options: null,
    correct_answer: null,
    grading_rubric: rubric(
      role,
      pick(role.openTypes, index),
      competency,
      'open_ended_scenario',
      level,
      org,
      stem,
    ),
    difficulty_score: difficulty(level, index, org),
    tags: [role.track, level, 'open_ended', industry],
    anti_cheat_seed: 'variant_A',
    generated_by: GENERATED_BY,
    date_generated: new Date().toISOString().slice(0, 10),
  };
}

function buildLong(
  role: RoleMeta,
  level: Level,
  index: number,
  lt1: boolean,
  bank: RoleScenarioBank,
): SourceQuestion {
  const industry = pick(INDUSTRIES, index + 2);
  const competency = pick(role.competencies, index + 1);
  const stem = pick(lt1 ? bank.lt1 : bank.lt2, index);
  const org = (level === 'senior' || level === 'expert') && index < 4;
  const prefix = lt1 ? 'LT1' : 'LT2';
  const id = `${role.code}-${LEVEL_CODE[level]}-ADV-${prefix}-${String(index + 1).padStart(3, '0')}`;

  return {
    id,
    role: role.role,
    role_code: role.code,
    role_family: role.family,
    level,
    assessment_stage: 'advanced_assessment',
    format: 'long_text',
    competency,
    question_type: lt1
      ? pick(role.longScenarioTypes, index)
      : pick(role.longWorkTypes, index),
    industry,
    estimated_time_seconds: 90,
    question: `${levelPrefix(level)}${stem} You are the ${role.role} at a ${industry} company. In one focused paragraph, explain your response with focus on ${competency.toLowerCase()}.`,
    options: null,
    correct_answer: null,
    grading_rubric: rubric(
      role,
      lt1
        ? pick(role.longScenarioTypes, index)
        : pick(role.longWorkTypes, index),
      competency,
      'long_text',
      level,
      org,
      stem,
    ),
    difficulty_score: difficulty(level, index, org),
    tags: [role.track, level, lt1 ? 'lt1' : 'lt2', industry],
    anti_cheat_seed: 'variant_A',
    generated_by: GENERATED_BY,
    date_generated: new Date().toISOString().slice(0, 10),
  };
}

function generate(): SourceQuestion[] {
  assertMinimums();
  const out: SourceQuestion[] = [];

  for (const role of ROLES) {
    const bank = scenariosFor(role.code);
    for (const level of LEVELS) {
      for (let i = 0; i < SET.mcq; i++)
        out.push(buildMcq(role, level, i, bank));
      for (let i = 0; i < SET.open; i++)
        out.push(buildOpen(role, level, i, bank));
      for (let i = 0; i < SET.lt1; i++)
        out.push(buildLong(role, level, i, true, bank));
      for (let i = 0; i < SET.lt2; i++)
        out.push(buildLong(role, level, i, false, bank));
    }
  }

  if (out.length !== TARGET_TOTAL) {
    throw new Error(`Expected ${TARGET_TOTAL}, got ${out.length}`);
  }

  return out;
}

function main(): void {
  const questions = generate();
  const outPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'data',
    'question-banks',
    'seed-advanced.json',
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(questions, null, 2));

  const manifest = {
    generated_by: GENERATED_BY,
    generated_at: new Date().toISOString(),
    seed_file: 'data/question-banks/seed-advanced.json',
    total_questions: questions.length,
    per_role_level: SET.mcq + SET.open + SET.lt1 + SET.lt2,
    composition_per_role_level: {
      mcq: SET.mcq,
      open_ended_scenario: SET.open,
      long_text_lt1: SET.lt1,
      long_text_lt2: SET.lt2,
    },
    runtime_session_needs: RUNTIME_MIN,
    roles: ROLES.length,
    levels: LEVELS,
    notes:
      'Role-specific scenario stems. Sized for ~3 zero-overlap sessions per role+level.',
  };

  const manifestPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'data',
    'question-banks',
    'seed-advanced.manifest.json',
  );
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`Wrote ${questions.length} questions to ${outPath}`);
  console.log(`Manifest: ${manifestPath}`);
}

main();
