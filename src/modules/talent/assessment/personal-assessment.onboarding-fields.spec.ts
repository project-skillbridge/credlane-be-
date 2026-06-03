import {
  PERSONAL_ASSESSMENT_SECTION_COUNT,
  PERSONAL_ASSESSMENT_SECTION_SLUG_TO_NUMBER,
  SKIPPED_ONBOARDING_ANSWER_KEYS,
} from './personal-assessment.schema';
import { createTestPersonalAssessmentQuestionService } from './personal-assessment-question.service';
import {
  getOnboardingBackedQuestionKeysFromTestQuestions,
  PERSONAL_ASSESSMENT_TEST_QUESTIONS,
} from './personal-assessment.test-questions';
import { validateSectionAnswers } from './personal-assessment.validation';
import {
  makeTalentProfile,
  section1Answers,
} from './personal-assessment.test-fixtures';

const ONBOARDING_PROFILE_FIELDS = [
  'track',
  'education_level',
  'region',
  'linkedin_url',
  'country',
] as const;

/** Onboarding-only fields that must not be storable assessment question keys. */
const ONBOARDING_ONLY_FIELD_KEYS = new Set<string>([
  ...ONBOARDING_PROFILE_FIELDS,
  'goal',
  'skill_track',
  'portfolio_url',
  'track',
  'educationLevel',
  'linkedinProfile',
  'linkedin_url',
]);

describe('personal assessment onboarding overlap', () => {
  const catalog = createTestPersonalAssessmentQuestionService();
  const allQuestions = PERSONAL_ASSESSMENT_TEST_QUESTIONS;
  const onboardingBackedKeys =
    getOnboardingBackedQuestionKeysFromTestQuestions();

  it('defines exactly 36 questions across 5 sections', () => {
    expect(allQuestions).toHaveLength(36);
    expect(
      allQuestions
        .map((question) => question.questionNumber)
        .sort((a, b) => a - b),
    ).toEqual([...Array(36)].map((_, index) => index + 1));
  });

  it('has at least one question per section', () => {
    for (
      let section = 1;
      section <= PERSONAL_ASSESSMENT_SECTION_COUNT;
      section++
    ) {
      expect(catalog.getSectionQuestions(section).length).toBeGreaterThan(0);
    }
  });

  it('marks onboarding-backed questions as skipStorage with profileField', () => {
    expect(onboardingBackedKeys).toEqual([
      'education_level',
      'country',
      'region',
      'skill_track',
      'portfolio_url',
    ]);

    for (const question of allQuestions.filter((q) => q.skipStorage)) {
      expect(question.profileField).toBeDefined();
      expect(ONBOARDING_PROFILE_FIELDS).toContain(question.profileField);
    }
  });

  it('lists every skipStorage key in SKIPPED_ONBOARDING_ANSWER_KEYS', () => {
    for (const key of onboardingBackedKeys) {
      expect(SKIPPED_ONBOARDING_ANSWER_KEYS.has(key)).toBe(true);
    }
    expect(SKIPPED_ONBOARDING_ANSWER_KEYS.has('track')).toBe(true);
    expect(SKIPPED_ONBOARDING_ANSWER_KEYS.has('educationLevel')).toBe(true);
    expect(SKIPPED_ONBOARDING_ANSWER_KEYS.has('linkedinProfile')).toBe(true);
    expect(SKIPPED_ONBOARDING_ANSWER_KEYS.has('claimed_level')).toBe(false);
    expect(SKIPPED_ONBOARDING_ANSWER_KEYS.has('claimedLevel')).toBe(false);
  });

  it('maps every test question section slug to a legacy section number', () => {
    for (const question of allQuestions) {
      const sectionNumber =
        PERSONAL_ASSESSMENT_SECTION_SLUG_TO_NUMBER[question.sectionSlug];
      expect(sectionNumber).toBeGreaterThanOrEqual(1);
      expect(sectionNumber).toBeLessThanOrEqual(
        PERSONAL_ASSESSMENT_SECTION_COUNT,
      );
    }
  });

  it('does not include goal as an assessment question', () => {
    const keys = allQuestions.map((question) => question.key);
    expect(keys).not.toContain('goal');
  });

  it('does not persist storable questions that duplicate onboarding field keys', () => {
    const storableKeys = allQuestions
      .filter((question) => !question.skipStorage)
      .map((question) => question.key);

    for (const key of storableKeys) {
      expect(ONBOARDING_ONLY_FIELD_KEYS.has(key)).toBe(false);
    }
  });

  it('section save ignores onboarding keys sent in the request body', () => {
    const profile = makeTalentProfile();
    const result = validateSectionAnswers(
      1,
      {
        ...section1Answers(),
        education_level: 'doctorate',
        country: 'Antarctica',
        region: 'Elsewhere',
        track: 'backend_developer',
        skill_track: 'backend_developer',
        portfolio_url: 'https://github.com/other',
        linkedin_url: 'https://linkedin.com/in/other',
        linkedinProfile: 'https://linkedin.com/in/other',
      },
      profile,
      catalog.getSectionQuestions(1),
    );

    expect(result.education_level).toBeUndefined();
    expect(result.country).toBeUndefined();
    expect(result.region).toBeUndefined();
    expect(result.track).toBeUndefined();
    expect(result.skill_track).toBeUndefined();
    expect(result.portfolio_url).toBeUndefined();
    expect(result.linkedin_url).toBeUndefined();
    expect(result.job_title).toBe('Software Engineer');
  });
});
