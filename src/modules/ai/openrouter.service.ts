import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, Output, zodSchema } from 'ai';
import { z } from 'zod';
import { env } from '../../config/env';

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly provider: ReturnType<typeof createOpenRouter>;
  private readonly model: string;

  constructor() {
    this.provider = createOpenRouter({
      apiKey: env.OPENROUTER_API_KEY,
      headers: {
        'HTTP-Referer': 'https://skillbridge.hng14.com',
        'X-Title': 'SkillBridge CredLane',
      },
    });
    this.model = env.OPENROUTER_MODEL;
  }

  async chat<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodType<T>,
    temperature = 0.2,
  ): Promise<T> {
    try {
      const result = await generateText({
        model: this.provider(this.model),
        output: Output.object({ schema: zodSchema(schema) }),
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      return result.output as T;
    } catch (error) {
      this.logger.error(`OpenRouter call failed: ${String(error)}`);
      throw new ServiceUnavailableException('AI service temporarily unavailable');
    }
  }
}
