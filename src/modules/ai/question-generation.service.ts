import { Injectable, Logger } from '@nestjs/common';
import { QuestionType } from '../assessments/entities/assessment-question.entity';
import { GeneratedQuestion, GenerateQuestionsInput } from './ai.types';
import { questionGenerationSchema } from './ai.schemas';
import { OpenRouterService } from './openrouter.service';

const SYSTEM_PROMPT = `You are a senior technical curriculum designer creating assessment questions for a professional skills evaluation platform.

Generate questions that accurately assess real-world competency. Return ONLY valid JSON — no markdown, no explanation outside the JSON object.`;

@Injectable()
export class QuestionGenerationService {
  private readonly logger = new Logger(QuestionGenerationService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  async generateQuestions(
    input: GenerateQuestionsInput,
  ): Promise<GeneratedQuestion[]> {
    const userPrompt = this.buildPrompt(input);

    const raw = await this.openRouter.chat(
      SYSTEM_PROMPT,
      userPrompt,
      questionGenerationSchema,
      0.7,
    );
    return raw.questions.map((q) => this.parseQuestion(q, input));
  }

  private buildPrompt(input: GenerateQuestionsInput): string {
    const isMcq =
      input.question_type === QuestionType.SINGLE_PICK ||
      input.question_type === QuestionType.MULTI_PICK;

    const lines = [
      `Track: ${input.track}`,
      `Level: ${input.verified_level}`,
      `Assessment type: ${input.assessment_type}`,
      `Question type: ${input.question_type}`,
      input.slot_type ? `Slot type: ${input.slot_type}` : null,
      input.competency ? `Competency: ${input.competency}` : null,
      input.industry_context
        ? `Industry context: ${input.industry_context}`
        : null,
      `Count: generate exactly ${input.count} question(s)`,
    ].filter(Boolean);

    const schema = isMcq
      ? `{"question_text":"...","options":["A","B","C","D"],"correct_answer":"A","competency":"...","industry_context":"..."}`
      : `{"question_text":"...","options":null,"correct_answer":null,"competency":"...","industry_context":"..."}`;

    return `${lines.join('\n')}

Return JSON: {"questions": [${schema}]}

Rules:
- question_text: clear, unambiguous, professionally worded
${isMcq ? '- options: exactly 4 strings, plausible distractors\n- correct_answer: must exactly match one option string' : '- Do NOT include options or correct_answer for text questions'}
- competency: short label (e.g. "stakeholder_management")
- Calibrate difficulty to the specified level
- Questions must NOT repeat onboarding fields (goal, region, educationLevel, linkedinProfile)`;
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
