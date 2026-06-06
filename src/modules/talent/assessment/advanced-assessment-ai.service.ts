import { Injectable } from '@nestjs/common';
import { AssessmentQuestion, QuestionType } from '../../assessments/entities';
import { resolveQuestionCompetency } from './competency-taxonomy';
import { TalentPersonalAssessmentContext } from './personal-assessment.service';

// Final question counts.
// Composition: 8 MCQ (30% weight) + 2 short-text + 5 long-text (70% weight combined).
export const ADVANCED_ASSESSMENT_TOTAL_QUESTIONS = 15;
export const ADVANCED_ASSESSMENT_MCQ_COUNT = 8;
export const ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT = 2;
export const ADVANCED_ASSESSMENT_LONG_TEXT_COUNT = 5;

export const ADVANCED_ASSESSMENT_BASE_LONG_TEXT_COUNT = 5; // 2 LT-1 + 3 LT-2
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
        // All 5 long-text questions served at session start.
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
    return questions.map((question, index) => {
      const competency = resolveQuestionCompetency({
        competency: question.competency,
        metadata: question.metadata,
      });

      return {
        question_id: question.id,
        question_number: startAt + index,
        block,
        question_type: question.question_type,
        question_text: question.question_text,
        options: question.options,
        slot_type: question.slot_type,
        metadata: competency
          ? { ...(question.metadata ?? {}), competency }
          : question.metadata,
        correct_answer: question.correct_answer,
        min_length,
        max_length,
      };
    });
  }
}
