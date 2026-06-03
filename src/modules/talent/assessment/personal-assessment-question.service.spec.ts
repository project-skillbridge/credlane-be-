import {
  createTestPersonalAssessmentQuestionService,
  PersonalAssessmentQuestionService,
} from './personal-assessment-question.service';
import {
  getOnboardingBackedQuestionKeysFromTestQuestions,
  PERSONAL_ASSESSMENT_TEST_QUESTIONS,
} from './personal-assessment.test-questions';
import { PERSONAL_ASSESSMENT_SECTION_SLUG_TO_NUMBER } from './personal-assessment.schema';

describe('PersonalAssessmentQuestionService', () => {
  let service: PersonalAssessmentQuestionService;

  beforeEach(() => {
    service = createTestPersonalAssessmentQuestionService();
  });

  it('loads 36 questions across sections 1 to 5', () => {
    expect(service.getAllQuestions()).toHaveLength(36);
    expect(service.getSectionQuestions(1)).toHaveLength(10);
    expect(service.getSectionQuestions(5)).toHaveLength(6);
    expect(service.getSectionQuestions(6)).toEqual([]);
  });

  it('resolves section numbers by question key', () => {
    expect(service.findQuestionSection('job_title')).toBe(1);
    expect(service.findQuestionSection('claimed_level')).toBe(2);
    expect(service.findQuestionSection('quick_learning_narrative')).toBe(5);
  });

  it('lists onboarding-backed keys from test questions', () => {
    expect(service.getOnboardingBackedQuestionKeys()).toEqual(
      getOnboardingBackedQuestionKeysFromTestQuestions(),
    );
  });

  it('maps section slugs to legacy section numbers', () => {
    for (const question of PERSONAL_ASSESSMENT_TEST_QUESTIONS) {
      const sectionNumber =
        PERSONAL_ASSESSMENT_SECTION_SLUG_TO_NUMBER[question.sectionSlug];
      expect(service.findQuestionSection(question.key)).toBe(sectionNumber);
    }
  });

  it('isolates the same field_name across tracks', async () => {
    const questionRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'PA-GEN-ALL-001',
          section: 'work_style',
          track: 'all',
          question: 'Global prompt',
          field_name: 'work_arrangement',
          format: 'single_select',
          required: true,
          options: [{ value: 'remote', label: 'Remote' }],
          display_order: 1,
          is_live: true,
        },
        {
          id: 'PA-FED-001',
          section: 'skills_and_expertise',
          track: 'frontend_developer',
          question: 'Track prompt',
          field_name: 'work_arrangement',
          format: 'text_required',
          required: true,
          options: null,
          display_order: 1,
          is_live: true,
        },
      ]),
    };

    const trackService = new PersonalAssessmentQuestionService(
      questionRepo as never,
    );
    await trackService.reloadFromDatabase();

    expect(trackService.findQuestionSection('work_arrangement')).toBe(5);
    expect(
      trackService.findQuestionSection('work_arrangement', 'frontend_developer'),
    ).toBe(2);
    expect(trackService.getAllQuestions('frontend_developer')).toHaveLength(1);
    expect(trackService.getAllQuestions('frontend_developer')[0].prompt).toBe(
      'Track prompt',
    );
    expect(trackService.getAllQuestions('backend_developer')).toHaveLength(1);
  });

  it('skips rows with unsupported formats during reload', async () => {
    const questionRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'PA-GEN-VALID-001',
          section: 'work_style',
          track: 'all',
          question: 'Valid prompt',
          field_name: 'work_arrangement',
          format: 'single_select',
          required: true,
          options: [{ value: 'remote', label: 'Remote' }],
          display_order: 1,
          is_live: true,
        },
        {
          id: 'PA-GEN-BAD-001',
          section: 'work_style',
          track: 'all',
          question: 'Bad prompt',
          field_name: 'bad_field',
          format: 'typo_select',
          required: true,
          options: null,
          display_order: 2,
          is_live: true,
        },
      ]),
    };

    const trackService = new PersonalAssessmentQuestionService(
      questionRepo as never,
    );
    await trackService.reloadFromDatabase();

    expect(trackService.getAllQuestions()).toHaveLength(1);
    expect(trackService.findQuestionSection('work_arrangement')).toBe(5);
    expect(trackService.findQuestionSection('bad_field')).toBe(0);
  });
});
