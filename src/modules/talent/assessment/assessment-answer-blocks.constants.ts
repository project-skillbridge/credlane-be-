export type AssessmentAnswerBlock = 'mcq' | 'short_text' | 'long_text';

export const ASSESSMENT_SHORT_TEXT_MIN_CHARS = 10;
export const ASSESSMENT_SHORT_TEXT_MAX_CHARS = 600;
export const ASSESSMENT_LONG_TEXT_MIN_CHARS = 60;
export const ASSESSMENT_LONG_TEXT_MAX_CHARS = 2000;

export function textLengthBoundsForBlock(block: AssessmentAnswerBlock): {
  min: number;
  max: number;
} | null {
  switch (block) {
    case 'short_text':
      return {
        min: ASSESSMENT_SHORT_TEXT_MIN_CHARS,
        max: ASSESSMENT_SHORT_TEXT_MAX_CHARS,
      };
    case 'long_text':
      return {
        min: ASSESSMENT_LONG_TEXT_MIN_CHARS,
        max: ASSESSMENT_LONG_TEXT_MAX_CHARS,
      };
    default:
      return null;
  }
}
