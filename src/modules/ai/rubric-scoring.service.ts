import { Injectable, Logger } from '@nestjs/common';
import { ScoredTextAnswer, TextAnswerInput } from './ai.types';
import { rubricFullSchema, rubricLt3Schema } from './ai.schemas';
import { OpenRouterService } from './openrouter.service';

const SYSTEM_PROMPT = `You are an expert technical assessor scoring candidate answers for a professional skills assessment.

Score each answer on the dimensions provided. Return ONLY valid JSON — no markdown, no explanation outside the JSON object.`;

const MAX_SCORE_FULL = 12;   // Relevance + Reasoning + Specificity + Completeness (3 pts each)
const MAX_SCORE_LT3  = 6;    // Relevance + Reasoning only (3 pts each)

@Injectable()
export class RubricScoringService {
  private readonly logger = new Logger(RubricScoringService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  async scoreAnswers(inputs: TextAnswerInput[]): Promise<ScoredTextAnswer[]> {
    if (inputs.length === 0) return [];
    const scored: ScoredTextAnswer[] = [];

    // Score sequentially to avoid bursty rate limits from free/shared models.
    for (const input of inputs) {
      scored.push(await this.scoreOne(input));
    }

    return scored;
  }

  private async scoreOne(input: TextAnswerInput): Promise<ScoredTextAnswer> {
    const isLt3 = input.is_lt3 === true;
    const dimensions = isLt3
      ? ['relevance (0-3)', 'reasoning (0-3)']
      : ['relevance (0-3)', 'reasoning (0-3)', 'specificity (0-3)', 'completeness (0-3)'];

    const userPrompt = `
Question: ${input.question_text}

Candidate answer: ${input.answer}

Score the answer on these dimensions:
${dimensions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Return JSON in this exact shape:
${isLt3
  ? `{"relevance":0,"reasoning":0,"total":0,"feedback":"one sentence"}`
  : `{"relevance":0,"reasoning":0,"specificity":0,"completeness":0,"total":0,"feedback":"one sentence"}`
}

Rules:
- Each dimension: integer 0, 1, 2, or 3 only
- total = sum of all dimension scores
- feedback: one sentence, specific to this answer
- Be strict — vague or generic answers score low on specificity`.trim();

    const maxScore = isLt3 ? MAX_SCORE_LT3 : MAX_SCORE_FULL;

    try {
      if (isLt3) {
        const raw = await this.openRouter.chat(SYSTEM_PROMPT, userPrompt, rubricLt3Schema, 0.1);
        return {
          question_id: input.question_id,
          rubric: { ...raw, specificity: 0, completeness: 0 },
          raw_score: raw.total,
          max_score: maxScore,
        };
      } else {
        const raw = await this.openRouter.chat(SYSTEM_PROMPT, userPrompt, rubricFullSchema, 0.1);
        return {
          question_id: input.question_id,
          rubric: raw,
          raw_score: raw.total,
          max_score: maxScore,
        };
      }
    } catch (error) {
      this.logger.warn(
        `Rubric scoring failed for question ${input.question_id}, storing null: ${String(error)}`,
      );
      return {
        question_id: input.question_id,
        rubric: { relevance: 0, reasoning: 0, specificity: 0, completeness: 0, total: 0, feedback: 'Score pending' },
        raw_score: 0,
        max_score: maxScore,
      };
    }
  }
}
