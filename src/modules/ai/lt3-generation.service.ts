import { Injectable } from '@nestjs/common';
import { GeneratedLt3Question, GenerateLt3Input } from './ai.types';
import { lt3Schema } from './ai.schemas';
import { OpenRouterService } from './openrouter.service';

const SYSTEM_PROMPT = `You are a senior technical assessor creating a follow-up reflection question based on a candidate's previous answer.

The question must reference a specific decision or action mentioned in the candidate's answer. Return ONLY valid JSON.`;

@Injectable()
export class Lt3GenerationService {
  constructor(private readonly openRouter: OpenRouterService) {}

  async generate(input: GenerateLt3Input): Promise<GeneratedLt3Question> {
    const userPrompt = `
Track: ${input.track}
Level: ${input.verified_level}

Previous question: ${input.lt2_question_text}

Candidate's answer: ${input.lt2_answer}

Generate one LT-3 reflection question that:
1. References a specific decision, approach, or tradeoff the candidate mentioned above
2. Asks them to reflect on WHY they made that choice and what they would do differently
3. Is phrased in second person ("You mentioned X... why did you...")
4. Is scored on Relevance and Reasoning only

Return JSON: {"question_text": "..."}`.trim();

    return this.openRouter.chat(SYSTEM_PROMPT, userPrompt, lt3Schema, 0.4);
  }
}
