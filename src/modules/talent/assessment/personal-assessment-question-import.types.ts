export type PersonalAssessmentQuestionTrackVariant = {
  options: { value: string; label: string }[];
};

export type PersonalAssessmentQuestionImportItem = {
  id: string;
  section: string;
  track: string;
  question: string;
  fieldName: string;
  format: 'single_select' | 'multi_select' | 'text_required' | 'text_optional';
  required: boolean;
  note?: string;
  options?: { value: string; label: string }[];
  trackVariants?: Record<string, PersonalAssessmentQuestionTrackVariant>;
};

export type PersonalAssessmentQuestionImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
};
