import { VerifiedLevel } from '../../assessments/entities/assessment-question.entity';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../entities/talent-profile.entity';
import { User, UserRole } from '../../users/entities/user.entity';

const NARRATIVE_80 =
  'This is a detailed narrative with more than eighty characters for validation purposes.';

export function makeTalentUser(overrides: Partial<User> = {}): User {
  return Object.assign(new User(), {
    id: 'talent-user-1',
    email: 'talent@example.com',
    password: null,
    first_name: 'Casey',
    last_name: 'Talent',
    avatar_url: null,
    country: 'Nigeria',
    is_verified: true,
    onboarding_complete: true,
    role: UserRole.TALENT,
    signup_reason: null,
    refreshTokenHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });
}

export function makeTalentProfile(
  overrides: Partial<TalentProfile> = {},
): TalentProfile {
  return Object.assign(new TalentProfile(), {
    id: 'profile-1',
    user_id: 'talent-user-1',
    role_track: null,
    role_tracks: null,
    goal: 'land_first_role',
    region: 'Lagos',
    education_level: 'bachelor',
    linkedin_url: 'https://www.linkedin.com/in/casey',
    track: 'frontend_developer',
    claimed_level: VerifiedLevel.MID,
    profile_verified: true,
    onboarding_step: 3,
    status: TalentProfileStatus.JOB_READY,
    bio: null,
    profile_share_link: null,
    is_published: false,
    published_at: null,
    personal_assessment_answers: null,
    personal_assessment_completed_at: null,
    skill_assessment_completed_at: null,
    advanced_assessment_completed_at: null,
    validated_level: null,
    assessment_locked_from: null,
    assessment_locked_until: null,
    advanced_retake_required: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });
}

/** All required stored answers across sections 1–5 (non-skipped questions only). */
export function buildFullPersonalAssessmentAnswers(): Record<string, unknown> {
  return {
    job_title: 'Software Engineer',
    years_experience: '3_5_yrs',
    industries: ['fintech'],
    largest_org_size: '51_200',
    org_types: ['startup_under_50'],
    student_status: 'no',
    primary_language: 'english',
    specialization: 'web_apps',
    claimed_level: VerifiedLevel.MID,
    primary_tool_duration: '1_2_years',
    mentoring_experience: 'yes_informally',
    shipped_deliverable: 'yes_multiple',
    managed_team: 'no',
    leadership_titles: ['team_lead'],
    difficult_decision_narrative: NARRATIVE_80,
    led_project_unsupervised: 'yes_once',
    hiring_experience: 'no',
    budget_responsibility: 'no',
    international_org_experience: 'yes_occasionally',
    remote_experience: 'yes_less_than_2_years',
    time_zones_collaborated: '1_2_time_zones',
    international_stakeholders: 'yes_occasionally',
    work_arrangement_preference: ['fully_remote'],
    remote_workspace_setup: 'yes_fully_set_up',
    deadline_handling: NARRATIVE_80,
    ideal_work_environment: NARRATIVE_80,
    feedback_preference: 'no_preference',
    workload_management: NARRATIVE_80,
    quick_learning_narrative: NARRATIVE_80,
  };
}

export function section1Answers(): Record<string, unknown> {
  return {
    job_title: 'Software Engineer',
    years_experience: '3_5_yrs',
    industries: ['fintech'],
    largest_org_size: '51_200',
    org_types: ['startup_under_50'],
    student_status: 'no',
    primary_language: 'english',
  };
}
