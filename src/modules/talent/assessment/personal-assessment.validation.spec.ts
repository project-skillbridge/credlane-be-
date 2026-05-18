import { UnprocessableEntityException } from '@nestjs/common';
import { OAUTH_DEFAULT_COUNTRY } from '../../users/users.service';
import {
  assertOnboardingFieldsForComplete,
  validateSectionAnswers,
} from './personal-assessment.validation';
import {
  makeTalentProfile,
  makeTalentUser,
  section1Answers,
} from './personal-assessment.test-fixtures';

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
        primary_tool_duration: '1_2_years',
        mentoring_experience: 'yes_informally',
        shipped_deliverable: 'yes_multiple',
        tools: [],
      },
      profile,
    );

    expect(result.tools).toEqual([]);
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

describe('assertOnboardingFieldsForComplete', () => {
  it('treats Unknown country as missing', () => {
    const profile = makeTalentProfile();
    const user = makeTalentUser({ country: OAUTH_DEFAULT_COUNTRY });

    try {
      assertOnboardingFieldsForComplete(profile, user);
      fail('expected UnprocessableEntityException');
    } catch (error: unknown) {
      const body = getExceptionBody(error);
      expect(body.missingOnboardingFields).toEqual(
        expect.arrayContaining(['country']),
      );
    }
  });

  it('passes when onboarding fields are present', () => {
    expect(() =>
      assertOnboardingFieldsForComplete(makeTalentProfile(), makeTalentUser()),
    ).not.toThrow();
  });
});
