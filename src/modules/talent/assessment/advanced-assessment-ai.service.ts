import { Injectable } from '@nestjs/common';
import { AssessmentQuestion, QuestionType } from '../../assessments/entities';
import { TalentPersonalAssessmentContext } from './personal-assessment.service';

// Final question counts (includes runtime-generated LT-3).
export const ADVANCED_ASSESSMENT_TOTAL_QUESTIONS = 15;
export const ADVANCED_ASSESSMENT_MCQ_COUNT = 5;
export const ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT = 5;
export const ADVANCED_ASSESSMENT_LONG_TEXT_COUNT = 5;

// What's actually served at session start. LT-3 is generated mid-session by
// POST /session/:id/lt2-submit and appended to the session jsonb at that point.
export const ADVANCED_ASSESSMENT_BASE_LONG_TEXT_COUNT = 4; // 2 LT-1 + 2 LT-2
export const ADVANCED_ASSESSMENT_BASE_QUESTIONS =
  ADVANCED_ASSESSMENT_MCQ_COUNT +
  ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT +
  ADVANCED_ASSESSMENT_BASE_LONG_TEXT_COUNT;

export type AdvancedAssessmentBlock = 'mcq' | 'short_text' | 'long_text';

export function blockLengthLimits(block: AdvancedAssessmentBlock): {
  min_length: number | null;
  max_length: number | null;
} {
  if (block === 'short_text') return { min_length: 10, max_length: 600 };
  if (block === 'long_text') return { min_length: 60, max_length: 2000 };
  return { min_length: null, max_length: null };
}

export type AdvancedAssessmentAiContext = TalentPersonalAssessmentContext & {
  track: string | null;
  verified_level: string;
};

export type AdvancedAssessmentGeneratedQuestion = {
  question_id: string;
  question_number: number;
  block: AdvancedAssessmentBlock;
  question_type: QuestionType;
  question_text: string;
  options: string[] | null;
  slot_type: string | null;
  metadata: Record<string, any> | null;
  correct_answer: string | null;
  min_length: number | null;
  max_length: number | null;
};

@Injectable()
export class AdvancedAssessmentAiService {
  generateQuestions(
    context: AdvancedAssessmentAiContext,
    questions: {
      mcq: AssessmentQuestion[];
      shortText: AssessmentQuestion[];
      longText: AssessmentQuestion[];
    },
  ): {
    context: AdvancedAssessmentAiContext;
    questions: AdvancedAssessmentGeneratedQuestion[];
  } {
    return {
      context,
      questions: [
        ...this.toBlock(
          questions.mcq.slice(0, ADVANCED_ASSESSMENT_MCQ_COUNT),
          'mcq',
          1,
        ),
        ...this.toBlock(
          questions.shortText.slice(0, ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT),
          'short_text',
          ADVANCED_ASSESSMENT_MCQ_COUNT + 1,
        ),
        // Only LT-1 + LT-2 are served at session start (4 items). LT-3 is
        // appended to the session jsonb by AdvancedAssessmentService.submitLt2().
        ...this.toBlock(
          questions.longText.slice(0, ADVANCED_ASSESSMENT_BASE_LONG_TEXT_COUNT),
          'long_text',
          ADVANCED_ASSESSMENT_MCQ_COUNT +
            ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT +
            1,
        ),
      ],
    };
  }

  private toBlock(
    questions: AssessmentQuestion[],
    block: AdvancedAssessmentBlock,
    startAt: number,
  ): AdvancedAssessmentGeneratedQuestion[] {
    const { min_length, max_length } = blockLengthLimits(block);
    return questions.map((question, index) => ({
      question_id: question.id,
      question_number: startAt + index,
      block,
      question_type: question.question_type,
      question_text: question.question_text,
      options: question.options,
      slot_type: question.slot_type,
      metadata: question.metadata,
      correct_answer: question.correct_answer,
      min_length,
      max_length,
    }));
  }
}
