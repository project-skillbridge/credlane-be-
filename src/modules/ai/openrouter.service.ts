import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { APICallError, generateText, Output, zodSchema } from 'ai';
import { z } from 'zod';
import { env } from '../../config/env';

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly provider: ReturnType<typeof createOpenRouter>;
  private readonly model: string;
  private readonly maxRetries = 4;
  private readonly timeoutMs = 45_000;

  constructor() {
    this.provider = createOpenRouter({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL,
      compatibility: 'strict',
      appUrl: 'https://skillbridge.hng14.com',
      appName: 'SkillBridge CredLane',
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
        model: this.provider(this.model, {
          structuredOutputs: { strict: false },
        }),
        output: Output.object({ schema: zodSchema(schema) }),
        temperature,
        maxRetries: this.maxRetries,
        timeout: this.timeoutMs,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      return result.output;
    } catch (error: unknown) {
      this.logger.error(this.formatError(error));
      throw new ServiceUnavailableException('AI service temporarily unavailable');
    }
  }

  private formatError(error: unknown): string {
    if (APICallError.isInstance(error)) {
      const parts = [
        `OpenRouter call failed: status=${error.statusCode ?? 'unknown'}`,
        `retryable=${String(error.isRetryable)}`,
      ];

      if (error.message) {
        parts.push(`message=${error.message}`);
      }
      if (error.responseBody) {
        parts.push(`response=${error.responseBody}`);
      }

      return parts.join(' ');
    }

    if (error instanceof Error) {
      return `OpenRouter call failed: ${error.name}: ${error.message}`;
    }

    return `OpenRouter call failed: ${String(error)}`;
  }
}
