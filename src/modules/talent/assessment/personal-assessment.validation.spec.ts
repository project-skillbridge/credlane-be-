import { UnprocessableEntityException } from '@nestjs/common';
import {
  assertAssessmentReadyForComplete,
  assertOnboardingFieldsForComplete,
  validateGeneratedPersonalAssessmentAnswers,
  validateSectionAnswers,
} from './personal-assessment.validation';
import {
  buildFullPersonalAssessmentAnswers,
  makeTalentProfile,
  makeTalentUser,
  section1Answers,
} from './personal-assessment.test-fixtures';
import { createTestPersonalAssessmentQuestionService } from './personal-assessment-question.service';

function getExceptionBody(error: unknown): Record<string, unknown> {
  expect(error).toBeInstanceOf(UnprocessableEntityException);
  return (error as UnprocessableEntityException).getResponse() as Record<
    string,
    unknown
  >;
}

describe('validateSectionAnswers', () => {
  const profile = makeTalentProfile();
  const catalog = createTestPersonalAssessmentQuestionService();

  it('returns sanitized section 1 answers', () => {
    const result = validateSectionAnswers(
      1,
      section1Answers(),
      profile,
      catalog.getSectionQuestions(1),
    );

    expect(result.job_title).toBe('Software Engineer');
    expect(result.years_experience).toBe('3_5_yrs');
    expect(result.country).toBeUndefined();
    expect(result.region).toBeUndefined();
  });

  it('lists allowed values when a single pick is invalid', () => {
    try {
      validateSectionAnswers(
        1,
        { ...section1Answers(), years_experience: 'not_a_valid_slug' },
        profile,
        catalog.getSectionQuestions(1),
      );
      fail('expected UnprocessableEntityException');
    } catch (error: unknown) {
      const body = getExceptionBody(error);
      expect(body.field).toBe('years_experience');
      expect(body.message).toContain('not_a_valid_slug');
      expect(body.message).toContain('Valid values are:');
      expect(body.message).toContain('3_5_yrs');
      expect(body.allowedValues).toEqual(
        expect.arrayContaining(['0_1_yr', '3_5_yrs', '10_plus_yrs']),
      );
    }
  });

  it('accepts an empty array for optional multi-select questions', () => {
    const result = validateSectionAnswers(
      2,
      {
        specialization: 'web_apps',
        claimed_level: 'mid',
        primary_tool_duration: '1_2_years',
        mentoring_experience: 'yes_informally',
        shipped_deliverable: 'yes_multiple',
        tools: [],
      },
      profile,
      catalog.getSectionQuestions(2),
    );

    expect(result.tools).toEqual([]);
    expect(result.claimed_level).toBe('mid');
  });

  it('requires claimed_level in personal assessment section 2', () => {
    try {
      validateSectionAnswers(
        2,
        {
          specialization: 'web_apps',
          primary_tool_duration: '1_2_years',
          mentoring_experience: 'yes_informally',
          shipped_deliverable: 'yes_multiple',
        },
        profile,
        catalog.getSectionQuestions(2),
      );
      fail('expected UnprocessableEntityException');
    } catch (error: unknown) {
      const body = getExceptionBody(error);
      expect(body.field).toBe('claimed_level');
      expect(body.message).toBe('claimed_level is required');
    }
  });

  it('accepts specialization for supported onboarding tracks with assessment mapping', () => {
    const fullstackProfile = makeTalentProfile({
      track: 'fullstack_developer',
    });

    const result = validateSectionAnswers(
      2,
      {
        specialization: 'web_apps',
        claimed_level: 'mid',
        primary_tool_duration: '1_2_years',
        mentoring_experience: 'yes_informally',
        shipped_deliverable: 'yes_multiple',
        tools: ['react'],
      },
      fullstackProfile,
      catalog.getSectionQuestions(2),
    );

    expect(result.specialization).toBe('web_apps');
  });

  it('accepts specialization for cybersecurity and marketing tracks using mapped assessment tracks', () => {
    const cyberProfile = makeTalentProfile({
      track: 'cybersecurity',
    });
    const marketingProfile = makeTalentProfile({
      track: 'marketing',
    });

    const cyberResult = validateSectionAnswers(
      2,
      {
        specialization: 'security',
        claimed_level: 'mid',
        primary_tool_duration: '1_2_years',
        mentoring_experience: 'yes_informally',
        shipped_deliverable: 'yes_multiple',
        tools: ['terraform'],
      },
      cyberProfile,
      catalog.getSectionQuestions(2),
    );

    const marketingResult = validateSectionAnswers(
      2,
      {
        specialization: 'digital_marketing',
        claimed_level: 'mid',
        primary_tool_duration: '1_2_years',
        mentoring_experience: 'yes_informally',
        shipped_deliverable: 'yes_multiple',
        tools: ['hubspot'],
      },
      marketingProfile,
      catalog.getSectionQuestions(2),
    );

    expect(cyberResult.specialization).toBe('security');
    expect(cyberResult.tools).toEqual(['terraform']);
    expect(marketingResult.specialization).toBe('digital_marketing');
    expect(marketingResult.tools).toEqual(['hubspot']);
  });

  it('requires onboarding track before validating specialization', () => {
    const profileWithoutTrack = makeTalentProfile({ track: null });

    try {
      validateSectionAnswers(
        2,
        { specialization: 'web_apps' },
        profileWithoutTrack,
        catalog.getSectionQuestions(2),
      );
      fail('expected UnprocessableEntityException');
    } catch (error: unknown) {
      const body = getExceptionBody(error);
      expect(body.field).toBe('specialization');
      expect(body.message).toContain('onboarding/track');
    }
  });
});

describe('validateGeneratedPersonalAssessmentAnswers', () => {
  const profile = makeTalentProfile();
  const questions =
    createTestPersonalAssessmentQuestionService().getAllQuestions();

  it('accepts sparse generated answers when claimed_level is present', () => {
    const result = validateGeneratedPersonalAssessmentAnswers(
      questions,
      {
        claimed_level: 'mid',
        job_title: 'Software Engineer',
      },
      profile,
    );

    expect(result).toEqual({
      claimed_level: 'mid',
      job_title: 'Software Engineer',
    });
  });

  it('rejects generated answers without claimed_level', () => {
    try {
      validateGeneratedPersonalAssessmentAnswers(
        questions,
        { job_title: 'Software Engineer' },
        profile,
      );
      fail('expected UnprocessableEntityException');
    } catch (error: unknown) {
      const body = getExceptionBody(error);
      expect(body.field).toBe('claimed_level');
      expect(body.message).toContain('claimed_level is required');
    }
  });
});

describe('assertAssessmentReadyForComplete', () => {
  const profile = makeTalentProfile();
  const user = makeTalentUser();
  const catalog = createTestPersonalAssessmentQuestionService();

  it('passes when all sections are saved and answers are valid', () => {
    expect(() =>
      assertAssessmentReadyForComplete(
        buildFullPersonalAssessmentAnswers(),
        [1, 2, 3, 4, 5],
        profile,
        user,
        catalog,
      ),
    ).not.toThrow();
  });

  it('aggregates missing sections and invalid required fields', () => {
    try {
      assertAssessmentReadyForComplete(
        { job_title: 'x' },
        [1],
        profile,
        user,
        catalog,
      );
      fail('expected UnprocessableEntityException');
    } catch (error: unknown) {
      const body = getExceptionBody(error);
      expect(body.message).toBe('Personal assessment is incomplete');
      expect(body.incompleteSections).toEqual(
        expect.arrayContaining([1, 2, 3, 4, 5]),
      );
      expect(body.missingFields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'section_2', section: 2 }),
          expect.objectContaining({ field: 'years_experience', section: 1 }),
        ]),
      );
    }
  });
});

describe('assertOnboardingFieldsForComplete', () => {
  it('does not require country before assessment', () => {
    const profile = makeTalentProfile();

    expect(() => assertOnboardingFieldsForComplete(profile)).not.toThrow();
  });

  it('passes when onboarding fields are present', () => {
    expect(() =>
      assertOnboardingFieldsForComplete(makeTalentProfile()),
    ).not.toThrow();
  });
});
