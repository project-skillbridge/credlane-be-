import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { APICallError, generateObject, zodSchema } from 'ai';
import { z } from 'zod';
import { env } from '../../config/env';

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly provider: ReturnType<typeof createOpenRouter>;
  private readonly model: string;
  private readonly maxRetries = 4;

  constructor() {
    if (!env.OPENROUTER_API_KEY) {
      this.logger.warn(
        'OPENROUTER_API_KEY is not configured; AI endpoints will be unavailable',
      );
    }

    this.provider = createOpenRouter({
      apiKey: env.OPENROUTER_API_KEY ?? '',
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
    if (!env.OPENROUTER_API_KEY) {
      throw new ServiceUnavailableException('AI service is not configured');
    }

    try {
      const result = await generateObject({
        model: this.provider(this.model, {
          structuredOutputs: { strict: false },
          plugins: [{ id: 'response-healing' }],
        }),
        schema: zodSchema(schema),
        temperature,
        maxRetries: this.maxRetries,
        system: systemPrompt,
        prompt: userPrompt,
      });
      return result.object;
    } catch (error: unknown) {
      this.logger.error(this.formatError(error));
      throw new ServiceUnavailableException(
        'AI service temporarily unavailable',
      );
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
