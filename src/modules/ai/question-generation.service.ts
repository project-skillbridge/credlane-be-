import { Injectable, Logger } from '@nestjs/common';
import { GeneratedQuestion, GenerateQuestionsInput } from './ai.types';
import { questionGenerationSchema } from './ai.schemas';
import { OpenRouterService } from './openrouter.service';
import {
  buildQuestionGenerationPrompt,
  QUESTION_GENERATION_SYSTEM_PROMPT,
} from './prompt-builders';

@Injectable()
export class QuestionGenerationService {
  private readonly logger = new Logger(QuestionGenerationService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  async generateQuestions(
    input: GenerateQuestionsInput,
  ): Promise<GeneratedQuestion[]> {
    const userPrompt = buildQuestionGenerationPrompt(input);

    const raw = await this.openRouter.chat(
      QUESTION_GENERATION_SYSTEM_PROMPT,
      userPrompt,
      questionGenerationSchema,
      0.3,
      false,
      undefined,
      'question_generation',
    );
    return raw.questions.map((q) => this.parseQuestion(q, input));
  }

  private parseQuestion(
    raw: {
      question_text: string;
      options: string[] | null;
      correct_answer: string | null;
      competency: string | null;
      industry_context: string | null;
    },
    input: GenerateQuestionsInput,
  ): GeneratedQuestion {
    return {
      question_text: raw.question_text,
      question_type: input.question_type,
      slot_type: input.slot_type ?? null,
      options: raw.options,
      correct_answer: raw.correct_answer,
      competency: raw.competency,
      industry_context: raw.industry_context,
    };
  }
}
