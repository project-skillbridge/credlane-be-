import { VerifiedLevel } from '../../assessments/entities/assessment-question.entity';
import { User } from '../../users/entities/user.entity';
import { TalentProfile } from '../entities/talent-profile.entity';
import type { PersonalAssessmentQuestionCatalog } from './personal-assessment-question.service';
import {
  PERSONAL_ASSESSMENT_SECTION_COUNT,
  PersonalAssessmentQuestion,
} from './personal-assessment.schema';
import { getSkippedProfileValue } from './personal-assessment.validation';

/** Flat AI Prompt Chain payload — onboarding (camelCase) plus all answer keys at one level. */
export type PersonalAssessmentAiPromptContextPayload = {
  track: string | null;
  educationLevel: string | null;
  region: string | null;
  linkedinProfile: string | null;
  claimedLevel: VerifiedLevel | null;
  country: string;
} & Record<string, unknown>;

function resolveContextAnswer(
  question: PersonalAssessmentQuestion,
  stored: Record<string, unknown>,
  profile: TalentProfile,
  user: User,
): unknown {
  if (question.skipStorage) {
    return getSkippedProfileValue(question, profile, user);
  }
  return stored[question.key] ?? null;
}

function collectMergedAnswers(
  stored: Record<string, unknown>,
  profile: TalentProfile,
  user: User,
  catalog: PersonalAssessmentQuestionCatalog,
): Record<string, unknown> {
  const answers: Record<string, unknown> = {};

  for (
    let section = 1;
    section <= PERSONAL_ASSESSMENT_SECTION_COUNT;
    section++
  ) {
    for (const question of catalog.getSectionQuestions(
      section,
      profile.track,
    )) {
      answers[question.key] = resolveContextAnswer(
        question,
        stored,
        profile,
        user,
      );

      if (question.otherTextKey) {
        answers[question.otherTextKey] = stored[question.otherTextKey] ?? null;
      }
      if (question.followUpKey) {
        answers[question.followUpKey] = stored[question.followUpKey] ?? null;
      }
    }
  }

  return answers;
}

export function buildPersonalAssessmentAiPromptContext(
  profile: TalentProfile,
  user: User,
  stored: Record<string, unknown>,
  catalog: PersonalAssessmentQuestionCatalog,
): PersonalAssessmentAiPromptContextPayload {
  const answers = collectMergedAnswers(stored, profile, user, catalog);

  return {
    track: profile.track ?? null,
    educationLevel: profile.education_level ?? null,
    region: profile.region ?? null,
    linkedinProfile: profile.linkedin_url ?? null,
    claimedLevel: profile.claimed_level ?? null,
    country: user.country,
    ...answers,
  };
}
