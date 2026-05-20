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
import { getAllPersonalAssessmentQuestions } from './personal-assessment.schema';

function getExceptionBody(error: unknown): Record<string, unknown> {
  expect(error).toBeInstanceOf(UnprocessableEntityException);
  return (error as UnprocessableEntityException).getResponse() as Record<
    string,
    unknown
  >;
}

describe('validateSectionAnswers', () => {
  const profile = makeTalentProfile();

  it('returns sanitized section 1 answers', () => {
    const result = validateSectionAnswers(1, section1Answers(), profile);

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
        specialization: 'frontend',
        claimed_level: 'mid',
        primary_tool_duration: '1_2_years',
        mentoring_experience: 'yes_informally',
        shipped_deliverable: 'yes_multiple',
        tools: [],
      },
      profile,
    );

    expect(result.tools).toEqual([]);
    expect(result.claimed_level).toBe('mid');
  });

  it('requires claimed_level in personal assessment section 2', () => {
    try {
      validateSectionAnswers(
        2,
        {
          specialization: 'frontend',
          primary_tool_duration: '1_2_years',
          mentoring_experience: 'yes_informally',
          shipped_deliverable: 'yes_multiple',
        },
        profile,
      );
      fail('expected UnprocessableEntityException');
    } catch (error: unknown) {
      const body = getExceptionBody(error);
      expect(body.field).toBe('claimed_level');
      expect(body.message).toBe('claimed_level is required');
    }
  });

  it('requires onboarding track before validating specialization', () => {
    const profileWithoutTrack = makeTalentProfile({ track: null });

    try {
      validateSectionAnswers(
        2,
        { specialization: 'frontend' },
        profileWithoutTrack,
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
  const questions = getAllPersonalAssessmentQuestions();

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

  it('passes when all sections are saved and answers are valid', () => {
    expect(() =>
      assertAssessmentReadyForComplete(
        buildFullPersonalAssessmentAnswers(),
        [1, 2, 3, 4, 5, 6, 7],
        profile,
        user,
      ),
    ).not.toThrow();
  });

  it('aggregates missing sections and invalid required fields', () => {
    try {
      assertAssessmentReadyForComplete({ job_title: 'x' }, [1], profile, user);
      fail('expected UnprocessableEntityException');
    } catch (error: unknown) {
      const body = getExceptionBody(error);
      expect(body.message).toBe('Personal assessment is incomplete');
      expect(body.incompleteSections).toEqual(
        expect.arrayContaining([2, 3, 4, 5, 6, 7]),
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
