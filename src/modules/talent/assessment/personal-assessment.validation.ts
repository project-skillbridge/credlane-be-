import { UnprocessableEntityException } from '@nestjs/common';
import { TalentProfile } from '../entities/talent-profile.entity';
import { User } from '../../users/entities/user.entity';
import { TALENT_CLAIMED_LEVELS } from '../talent.constants';
import {
  ONBOARDING_TRACK_TO_ASSESSMENT_TRACK,
  PERSONAL_ASSESSMENT_SECTION_COUNT,
  PersonalAssessmentQuestion,
  SPECIALIZATIONS_BY_TRACK,
  TOOLS_BY_TRACK,
} from './personal-assessment.schema';
import type { PersonalAssessmentQuestionCatalog } from './personal-assessment-question.service';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string')
  );
}

function resolveAssessmentTrack(profile: TalentProfile): string | null {
  if (!profile.track) {
    return null;
  }
  return ONBOARDING_TRACK_TO_ASSESSMENT_TRACK[profile.track] ?? null;
}

function getDynamicOptions(
  question: PersonalAssessmentQuestion,
  profile: TalentProfile,
): readonly string[] | undefined {
  if (question.key === 'specialization') {
    const track = resolveAssessmentTrack(profile);
    return track ? SPECIALIZATIONS_BY_TRACK[track] : undefined;
  }
  if (question.key === 'tools') {
    const track = resolveAssessmentTrack(profile);
    return track ? TOOLS_BY_TRACK[track] : undefined;
  }
  if (question.key === 'claimed_level') {
    return TALENT_CLAIMED_LEVELS;
  }
  return question.options;
}

function isTrackDependentQuestion(
  question: PersonalAssessmentQuestion,
): boolean {
  return question.key === 'specialization' || question.key === 'tools';
}

function questionHasAnswerValue(
  question: PersonalAssessmentQuestion,
  value: unknown,
): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (question.inputType === 'multi') {
    return isStringArray(value);
  }
  if (question.inputType === 'text_optional') {
    return isNonEmptyString(value);
  }
  return isNonEmptyString(value);
}

function throwFieldError(payload: {
  message: string;
  field: string;
  allowedValues?: readonly string[];
  receivedValue?: string | string[];
  section?: number;
}): never {
  throw new UnprocessableEntityException({
    ...payload,
    allowedValues: payload.allowedValues
      ? [...payload.allowedValues]
      : undefined,
  });
}

function formatAllowedValuesList(options: readonly string[]): string {
  return options.join(', ');
}

function invalidSinglePickMessage(
  field: string,
  received: string,
  options: readonly string[],
): string {
  return `Invalid value for ${field}: "${received}". Valid values are: ${formatAllowedValuesList(options)}`;
}

function invalidMultiPickMessage(
  field: string,
  invalid: string[],
  options: readonly string[],
): string {
  const receivedList = invalid.map((item) => `"${item}"`).join(', ');
  return `Invalid value(s) for ${field}: ${receivedList}. Valid values are: ${formatAllowedValuesList(options)}`;
}

/** Ensures track-based options exist before validating specialization / tools. */
function resolveOptionsForValidation(
  question: PersonalAssessmentQuestion,
  profile: TalentProfile,
  value: unknown,
): readonly string[] | undefined {
  const options = getDynamicOptions(question, profile);

  if (!isTrackDependentQuestion(question)) {
    return options;
  }

  if (!questionHasAnswerValue(question, value)) {
    return options;
  }

  if (!profile.track?.trim()) {
    throwFieldError({
      message: `${question.key} requires a skill track on your profile. Complete talent onboarding (POST /api/v1/talent/onboarding/track) before saving this section.`,
      field: question.key,
    });
  }

  const assessmentTrack = resolveAssessmentTrack(profile);
  if (!assessmentTrack) {
    throwFieldError({
      message: `Cannot validate ${question.key} for track "${profile.track}". Use a supported onboarding track value.`,
      field: question.key,
      receivedValue: profile.track,
    });
  }

  if (!options?.length) {
    throwFieldError({
      message: `No ${question.key} options are configured for assessment track "${assessmentTrack}".`,
      field: question.key,
    });
  }

  return options;
}

function validateQuestionValue(
  question: PersonalAssessmentQuestion,
  value: unknown,
  options: readonly string[] | undefined,
): void {
  switch (question.inputType) {
    case 'text_required': {
      if (!isNonEmptyString(value)) {
        throw new UnprocessableEntityException({
          message: `${question.key} is required`,
          field: question.key,
        });
      }
      if (
        question.minLength !== undefined &&
        value.trim().length < question.minLength
      ) {
        throw new UnprocessableEntityException({
          message: `${question.key} must be at least ${question.minLength} characters`,
          field: question.key,
        });
      }
      return;
    }
    case 'text_optional': {
      if (value === undefined || value === null || value === '') {
        return;
      }
      if (!isNonEmptyString(value)) {
        throw new UnprocessableEntityException({
          message: `${question.key} must be a string`,
          field: question.key,
        });
      }
      if (
        question.minLength !== undefined &&
        value.trim().length < question.minLength
      ) {
        throw new UnprocessableEntityException({
          message: `${question.key} must be at least ${question.minLength} characters`,
          field: question.key,
        });
      }
      return;
    }
    case 'single': {
      if (!isNonEmptyString(value)) {
        throwFieldError({
          message: `${question.key} is required`,
          field: question.key,
        });
      }
      if (!options?.length) {
        throwFieldError({
          message: `No valid options are available for ${question.key}.`,
          field: question.key,
          receivedValue: value,
        });
      }
      if (!options.includes(value)) {
        throwFieldError({
          message: invalidSinglePickMessage(question.key, value, options),
          field: question.key,
          allowedValues: options,
          receivedValue: value,
        });
      }
      return;
    }
    case 'multi': {
      const isValidMultiValue =
        isStringArray(value) ||
        (!question.required &&
          Array.isArray(value) &&
          value.every((item) => typeof item === 'string'));

      if (!isValidMultiValue) {
        throwFieldError({
          message: question.required
            ? `${question.key} must be a non-empty array of strings`
            : `${question.key} must be an array of strings`,
          field: question.key,
        });
      }
      if (!options?.length) {
        throwFieldError({
          message: `No valid options are available for ${question.key}.`,
          field: question.key,
          receivedValue: value,
        });
      }
      if (Array.isArray(value) && value.length > 0) {
        const invalid = value.filter((item) => !options.includes(item));
        if (invalid.length > 0) {
          throwFieldError({
            message: invalidMultiPickMessage(question.key, invalid, options),
            field: question.key,
            allowedValues: options,
            receivedValue: invalid,
          });
        }
      }
    }
  }
}

export function validateSectionAnswers(
  section: number,
  answers: Record<string, unknown>,
  profile: TalentProfile,
  questions: PersonalAssessmentQuestion[],
): Record<string, unknown> {
  if (questions.length === 0) {
    throw new UnprocessableEntityException({
      message: 'Invalid section number',
      field: 'section',
    });
  }

  const sanitized: Record<string, unknown> = {};

  for (const question of questions) {
    if (question.skipStorage) {
      continue;
    }

    const value = answers[question.key];

    if (question.required && (value === undefined || value === null)) {
      throwFieldError({
        message: `${question.key} is required`,
        field: question.key,
      });
    }

    if (value === undefined || value === null) {
      continue;
    }

    const options = resolveOptionsForValidation(question, profile, value);
    validateQuestionValue(question, value, options);
    sanitized[question.key] = typeof value === 'string' ? value.trim() : value;

    if (question.otherTextKey) {
      const otherValue = answers[question.otherTextKey];
      const selected = sanitized[question.key];
      const includesOther =
        question.inputType === 'multi'
          ? isStringArray(selected) && selected.includes('other')
          : selected === 'other';

      if (includesOther) {
        if (!isNonEmptyString(otherValue)) {
          throw new UnprocessableEntityException({
            message: `${question.otherTextKey} is required when other is selected`,
            field: question.otherTextKey,
          });
        }
        sanitized[question.otherTextKey] = otherValue.trim();
      }
    }

    if (question.followUpKey && question.followUpWhen) {
      const followUpValue = answers[question.followUpKey];
      if (sanitized[question.key] === question.followUpWhen) {
        if (!isNonEmptyString(followUpValue)) {
          throw new UnprocessableEntityException({
            message: `${question.followUpKey} is required`,
            field: question.followUpKey,
          });
        }
        sanitized[question.followUpKey] = followUpValue.trim();
      }
    }
  }

  return sanitized;
}

export function validateGeneratedPersonalAssessmentAnswers(
  questions: PersonalAssessmentQuestion[],
  answers: Record<string, unknown>,
  profile: TalentProfile,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const question of questions) {
    if (question.skipStorage && question.key !== 'claimed_level') {
      continue;
    }

    const value = answers[question.key];

    if (
      question.key === 'claimed_level' &&
      (value === undefined || value === null)
    ) {
      throwFieldError({
        message: `${question.key} is required`,
        field: question.key,
      });
    }

    if (value === undefined || value === null) {
      continue;
    }

    const options = resolveOptionsForValidation(question, profile, value);
    validateQuestionValue(question, value, options);
    sanitized[question.key] = typeof value === 'string' ? value.trim() : value;

    if (question.otherTextKey) {
      const otherValue = answers[question.otherTextKey];
      const selected = sanitized[question.key];
      const includesOther =
        question.inputType === 'multi'
          ? isStringArray(selected) && selected.includes('other')
          : selected === 'other';

      if (includesOther) {
        if (!isNonEmptyString(otherValue)) {
          throw new UnprocessableEntityException({
            message: `${question.otherTextKey} is required when other is selected`,
            field: question.otherTextKey,
          });
        }
        sanitized[question.otherTextKey] = otherValue.trim();
      }
    }

    if (question.followUpKey && question.followUpWhen) {
      const followUpValue = answers[question.followUpKey];
      if (sanitized[question.key] === question.followUpWhen) {
        if (!isNonEmptyString(followUpValue)) {
          throw new UnprocessableEntityException({
            message: `${question.followUpKey} is required`,
            field: question.followUpKey,
          });
        }
        sanitized[question.followUpKey] = followUpValue.trim();
      }
    }
  }

  return sanitized;
}

export function getSkippedProfileValue(
  question: PersonalAssessmentQuestion,
  profile: TalentProfile,
  user: User,
): unknown {
  switch (question.profileField) {
    case 'track':
      return profile.track;
    case 'education_level':
      return profile.education_level;
    case 'region':
      return profile.region;
    case 'linkedin_url':
      return profile.linkedin_url;
    case 'claimed_level':
      return profile.claimed_level;
    case 'country':
      return user.country;
    default:
      return null;
  }
}

export function assertOnboardingFieldsForComplete(
  profile: TalentProfile,
): void {
  const missing: string[] = [];

  if (!profile.track?.trim()) {
    missing.push('track');
  }
  if (!profile.education_level?.trim()) {
    missing.push('educationLevel');
  }
  if (!profile.region?.trim()) {
    missing.push('region');
  }

  if (missing.length > 0) {
    throw new UnprocessableEntityException({
      message:
        'Complete talent onboarding before finishing personal assessment',
      missingOnboardingFields: missing,
    });
  }
}

export type PersonalAssessmentFieldIssue = {
  field: string;
  section: number;
  message: string;
};

export function resolveStoredAnswerValue(
  question: PersonalAssessmentQuestion,
  storedAnswers: Record<string, unknown>,
  profile: TalentProfile,
  user: User,
): unknown {
  if (question.skipStorage) {
    return getSkippedProfileValue(question, profile, user);
  }
  return storedAnswers[question.key] ?? null;
}

function collectQuestionCompleteIssues(
  question: PersonalAssessmentQuestion,
  storedAnswers: Record<string, unknown>,
  profile: TalentProfile,
  user: User,
  section: number,
): PersonalAssessmentFieldIssue[] {
  const issues: PersonalAssessmentFieldIssue[] = [];

  if (!question.required) {
    return issues;
  }

  const value = resolveStoredAnswerValue(
    question,
    storedAnswers,
    profile,
    user,
  );

  if (!questionHasAnswerValue(question, value)) {
    const message = question.skipStorage
      ? `Missing required onboarding field: ${question.key}`
      : `${question.key} is required`;
    issues.push({ field: question.key, section, message });
    return issues;
  }

  try {
    const options = resolveOptionsForValidation(question, profile, value);
    const needsEnumValidation =
      question.inputType === 'single' || question.inputType === 'multi';
    if (needsEnumValidation && !question.options?.length && !options?.length) {
      return issues;
    }
    validateQuestionValue(question, value, options);
  } catch (error: unknown) {
    const message =
      error instanceof UnprocessableEntityException
        ? String(
            (error.getResponse() as { message?: string }).message ??
              'Invalid value',
          )
        : 'Invalid value';
    issues.push({ field: question.key, section, message });
    return issues;
  }

  if (question.otherTextKey) {
    const selected = question.skipStorage ? value : storedAnswers[question.key];
    const includesOther =
      question.inputType === 'multi'
        ? isStringArray(selected) && selected.includes('other')
        : selected === 'other';

    if (
      includesOther &&
      !isNonEmptyString(storedAnswers[question.otherTextKey])
    ) {
      issues.push({
        field: question.otherTextKey,
        section,
        message: `${question.otherTextKey} is required when other is selected`,
      });
    }
  }

  if (question.followUpKey && question.followUpWhen) {
    const mainValue = question.skipStorage
      ? value
      : storedAnswers[question.key];
    if (mainValue === question.followUpWhen) {
      if (!isNonEmptyString(storedAnswers[question.followUpKey])) {
        issues.push({
          field: question.followUpKey,
          section,
          message: `${question.followUpKey} is required`,
        });
      }
    }
  }

  return issues;
}

/** Validates onboarding, saved sections, and every required answer before complete. */
export function assertAssessmentReadyForComplete(
  storedAnswers: Record<string, unknown>,
  completedSections: number[],
  profile: TalentProfile,
  user: User,
  catalog: PersonalAssessmentQuestionCatalog,
): void {
  const issues: PersonalAssessmentFieldIssue[] = [];
  const completedSet = new Set(completedSections);

  for (
    let section = 1;
    section <= PERSONAL_ASSESSMENT_SECTION_COUNT;
    section++
  ) {
    if (!completedSet.has(section)) {
      issues.push({
        field: `section_${section}`,
        section,
        message: `Section ${section} must be saved before completing the assessment`,
      });
    }

    for (const question of catalog.getSectionQuestions(
      section,
      profile.track,
    )) {
      issues.push(
        ...collectQuestionCompleteIssues(
          question,
          storedAnswers,
          profile,
          user,
          section,
        ),
      );
    }
  }

  if (issues.length > 0) {
    const incompleteSections = [
      ...new Set(issues.map((issue) => issue.section)),
    ].sort((a, b) => a - b);

    throw new UnprocessableEntityException({
      message: 'Personal assessment is incomplete',
      missingFields: issues,
      incompleteSections,
    });
  }
}
