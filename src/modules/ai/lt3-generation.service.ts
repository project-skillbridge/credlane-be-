import { Injectable } from '@nestjs/common';
import { GeneratedLt3Question, GenerateLt3Input } from './ai.types';
import { lt3Schema } from './ai.schemas';
import { OpenRouterService } from './openrouter.service';
import {
  buildLt3GenerationPrompt,
  LT3_GENERATION_SYSTEM_PROMPT,
} from './prompt-builders';

@Injectable()
export class Lt3GenerationService {
  constructor(private readonly openRouter: OpenRouterService) {}

  async generate(input: GenerateLt3Input): Promise<GeneratedLt3Question> {
    const userPrompt = buildLt3GenerationPrompt(input);

    return this.openRouter.chat(
      LT3_GENERATION_SYSTEM_PROMPT,
      userPrompt,
      lt3Schema,
      0.4,
      false,
      undefined,
      'lt3_generation',
    );
  }
}
