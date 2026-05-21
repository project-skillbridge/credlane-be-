import { Injectable, Logger } from '@nestjs/common';
import { ScoredTextAnswer, TextAnswerInput } from './ai.types';
import { rubricFullSchema, rubricLt3Schema } from './ai.schemas';
import { OpenRouterService } from './openrouter.service';

const SYSTEM_PROMPT = `You are an expert technical assessor scoring candidate answers for a professional skills assessment.

Score each answer on the dimensions provided. Return ONLY valid JSON — no markdown, no explanation outside the JSON object.`;

const MAX_SCORE_FULL = 12; // Relevance + Reasoning + Specificity + Completeness (0–3 each)
const MAX_SCORE_LT3 = 8; // Relevance + Reasoning only (0–4 each)

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
    const maxScore = isLt3 ? MAX_SCORE_LT3 : MAX_SCORE_FULL;

    const dimensions = isLt3
      ? ['relevance (0-4)', 'reasoning (0-4)']
      : [
          'relevance (0-3)',
          'reasoning (0-3)',
          'specificity (0-3)',
          'completeness (0-3)',
        ];

    const dimensionRule = isLt3
      ? '- Each dimension: integer 0, 1, 2, 3, or 4 only'
      : '- Each dimension: integer 0, 1, 2, or 3 only';

    const shapeExample = isLt3
      ? `{"relevance":0,"reasoning":0,"total":0,"feedback":"one sentence"}`
      : `{"relevance":0,"reasoning":0,"specificity":0,"completeness":0,"total":0,"feedback":"one sentence"}`;

    const userPrompt = `
Question: ${input.question_text}

Candidate answer: ${input.answer}

Score the answer on these dimensions:
${dimensions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Return JSON in this exact shape:
${shapeExample}

Rules:
${dimensionRule}
- total = sum of all dimension scores (max ${maxScore})
- feedback: one sentence, specific to this answer
- Be strict — vague or generic answers score low${isLt3 ? '' : ' on specificity'}`.trim();

    try {
      if (isLt3) {
        const raw = await this.openRouter.chat(
          SYSTEM_PROMPT,
          userPrompt,
          rubricLt3Schema,
          0.1,
        );
        return {
          question_id: input.question_id,
          rubric: { ...raw, specificity: 0, completeness: 0 },
          raw_score: raw.total,
          max_score: maxScore,
        };
      }

      const raw = await this.openRouter.chat(
        SYSTEM_PROMPT,
        userPrompt,
        rubricFullSchema,
        0.1,
      );
      return {
        question_id: input.question_id,
        rubric: raw,
        raw_score: raw.total,
        max_score: maxScore,
      };
    } catch (error) {
      this.logger.warn(
        `Rubric scoring failed for question ${input.question_id}; storing pending: ${String(error)}`,
      );
      return {
        question_id: input.question_id,
        rubric: {
          relevance: 0,
          reasoning: 0,
          specificity: 0,
          completeness: 0,
          total: 0,
          feedback: 'Score pending',
          pending: true,
        },
        raw_score: 0,
        max_score: maxScore,
      };
    }
  }
}
