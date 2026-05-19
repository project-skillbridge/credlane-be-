import { Injectable } from '@nestjs/common';
import { AssessmentQuestion, QuestionType } from '../../assessments/entities';
import { TalentPersonalAssessmentContext } from './personal-assessment.service';

export const ADVANCED_ASSESSMENT_TOTAL_QUESTIONS = 25;
export const ADVANCED_ASSESSMENT_MCQ_COUNT = 10;
export const ADVANCED_ASSESSMENT_SHORT_TEXT_COUNT = 10;
export const ADVANCED_ASSESSMENT_LONG_TEXT_COUNT = 5;

export type AdvancedAssessmentBlock = 'mcq' | 'short_text' | 'long_text';

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
        ...this.toBlock(
          questions.longText.slice(0, ADVANCED_ASSESSMENT_LONG_TEXT_COUNT),
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
    return questions.map((question, index) => ({
      question_id: question.id,
      question_number: startAt + index,
      block,
      question_type: question.question_type,
      question_text: question.question_text,
      options: question.options,
      slot_type: question.slot_type,
      metadata: question.metadata,
      correct_answer: question.correct_answer
    }));
  }
}
