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
      trackService.findQuestionSection(
        'work_arrangement',
        'frontend_developer',
      ),
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

  it('imports track_variants as per-track question rows', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const findOne = jest.fn().mockResolvedValue(null);
    const save = jest
      .fn()
      .mockImplementation((_entity, payload) => Promise.resolve(payload));
    const create = jest.fn().mockImplementation((_entity, payload) => payload);
    const update = jest.fn().mockResolvedValue(undefined);
    const questionRepo = { find, findOne, save, create, update };

    const importService = new PersonalAssessmentQuestionService(
      questionRepo as never,
    );

    const result = await importService.importQuestions([
      {
        id: 'PA-GEN-PRO-013',
        section: 'professional_background',
        track: 'all',
        question: 'Specialisation?',
        fieldName: 'track_specialisation',
        format: 'single_select',
        required: true,
        trackVariants: {
          FED: {
            options: [{ value: 'ui_focused', label: 'UI-focused' }],
          },
        },
      },
    ]);

    expect(result.inserted).toBe(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'PA-GEN-PRO-013__FED',
        track: 'frontend_developer',
        field_name: 'track_specialisation',
        options: [{ value: 'ui_focused', label: 'UI-focused' }],
      }),
    );
    expect(find).toHaveBeenCalled();
  });

  it('imports text_required questions without options or track_variants', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const findOne = jest.fn().mockResolvedValue(null);
    const save = jest
      .fn()
      .mockImplementation((payload) => Promise.resolve(payload));
    const create = jest.fn().mockImplementation((payload) => payload);
    const update = jest.fn().mockResolvedValue(undefined);
    const questionRepo = { find, findOne, save, create, update };

    const importService = new PersonalAssessmentQuestionService(
      questionRepo as never,
    );

    const result = await importService.importQuestions([
      {
        id: 'PA-GEN-PRO-014',
        section: 'work_style',
        track: 'all',
        question: 'Describe your ideal work environment',
        fieldName: 'ideal_work_environment',
        format: 'text_required',
        required: true,
      },
    ]);

    expect(result.inserted).toBe(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'PA-GEN-PRO-014',
        track: 'all',
        field_name: 'ideal_work_environment',
        format: 'text_required',
        options: null,
        is_live: true,
      }),
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalled();
  });

  it('reports skipped when variant id expansion exceeds the database limit', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const findOne = jest.fn().mockResolvedValue(null);
    const save = jest.fn();
    const create = jest.fn();
    const update = jest.fn();
    const questionRepo = { find, findOne, save, create, update };

    const importService = new PersonalAssessmentQuestionService(
      questionRepo as never,
    );

    const result = await importService.importQuestions([
      {
        id: 'PA-GEN-PRO-013-EXTRA-LONG-BASE-ID-NEAR-LIMIT-XX',
        section: 'professional_background',
        track: 'all',
        question: 'Specialisation?',
        fieldName: 'track_specialisation',
        format: 'single_select',
        required: true,
        trackVariants: {
          FED: { options: [{ value: 'ui_focused', label: 'UI-focused' }] },
        },
      },
    ]);

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toContain('exceeds 50 characters');
    expect(create).not.toHaveBeenCalled();
  });

  it('reports skipped when expansion produces no rows', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const findOne = jest.fn().mockResolvedValue(null);
    const save = jest.fn();
    const create = jest.fn();
    const update = jest.fn();
    const questionRepo = { find, findOne, save, create, update };

    const importService = new PersonalAssessmentQuestionService(
      questionRepo as never,
    );

    const result = await importService.importQuestions([
      {
        id: 'PA-GEN-BAD-SELECT',
        section: 'work_style',
        track: 'all',
        question: 'Pick one',
        fieldName: 'work_arrangement',
        format: 'single_select',
        required: true,
      },
    ]);

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([
      'PA-GEN-BAD-SELECT: no rows produced for format "single_select" (field "work_arrangement"); provide options or track_variants for select questions',
    ]);
    expect(create).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('maps validation metadata from database rows', async () => {
    const questionRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'PA-TEST-META-001',
          section: 'professional_background',
          track: 'all',
          question: 'Highest education level',
          field_name: 'education_level',
          format: 'single_select',
          required: true,
          options: [{ value: 'bachelor', label: 'Bachelor' }],
          skip_storage: true,
          profile_field: 'education_level',
          min_length: null,
          max_length: null,
          other_text_key: null,
          follow_up_key: null,
          follow_up_when: null,
          display_order: 1,
          is_live: true,
        },
        {
          id: 'PA-TEST-META-002',
          section: 'work_style',
          track: 'all',
          question: 'Describe your ideal environment',
          field_name: 'ideal_work_environment',
          format: 'text_required',
          required: true,
          options: null,
          skip_storage: false,
          profile_field: null,
          min_length: 60,
          max_length: 1000,
          other_text_key: null,
          follow_up_key: null,
          follow_up_when: null,
          display_order: 2,
          is_live: true,
        },
      ]),
    };

    const trackService = new PersonalAssessmentQuestionService(
      questionRepo as never,
    );
    await trackService.reloadFromDatabase();

    expect(trackService.getOnboardingBackedQuestionKeys()).toEqual([
      'education_level',
    ]);
    const narrative = trackService
      .getAllQuestions()
      .find((question) => question.key === 'ideal_work_environment');
    expect(narrative?.minLength).toBe(60);
    expect(narrative?.maxLength).toBe(1000);
  });
});
