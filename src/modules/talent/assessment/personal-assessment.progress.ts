import { PERSONAL_ASSESSMENT_SECTION_COUNT } from './personal-assessment.schema';

export type PersonalAssessmentStoreMeta = {
  completedSections?: number[];
};

export type PersonalAssessmentResumeProgress = {
  completedSections: number[];
  nextSection: number | null;
  totalSections: number;
  sectionsCompleted: number;
  isComplete: boolean;
};

export function readCompletedSections(
  meta: PersonalAssessmentStoreMeta | undefined,
): number[] {
  const sections = meta?.completedSections ?? [];
  return [...new Set(sections)]
    .filter(
      (section) =>
        Number.isInteger(section) &&
        section >= 1 &&
        section <= PERSONAL_ASSESSMENT_SECTION_COUNT,
    )
    .sort((a, b) => a - b);
}

export function getPersonalAssessmentProgress(
  meta: PersonalAssessmentStoreMeta | undefined,
): PersonalAssessmentResumeProgress {
  const completedSections = readCompletedSections(meta);
  const completedSet = new Set(completedSections);
  let nextSection: number | null = null;

  for (
    let section = 1;
    section <= PERSONAL_ASSESSMENT_SECTION_COUNT;
    section++
  ) {
    if (!completedSet.has(section)) {
      nextSection = section;
      break;
    }
  }

  return {
    completedSections,
    nextSection,
    totalSections: PERSONAL_ASSESSMENT_SECTION_COUNT,
    sectionsCompleted: completedSections.length,
    isComplete: completedSections.length === PERSONAL_ASSESSMENT_SECTION_COUNT,
  };
}
