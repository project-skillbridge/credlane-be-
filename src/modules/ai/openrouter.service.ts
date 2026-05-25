import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { APICallError, generateObject, zodSchema, LanguageModel } from 'ai';
import { z } from 'zod';
import { env } from '../../config/env';

type AiProviderFactory = (modelId: string, options?: unknown) => LanguageModel;

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly maxRetries = 4;
  private readonly useAnthropic: boolean;
  private readonly useGemini: boolean;

  private readonly anthropicProvider: AiProviderFactory | null;
  private readonly googleProvider: AiProviderFactory | null;
  private readonly openRouterProvider: AiProviderFactory | null;

  constructor() {
    this.useAnthropic = !!env.ANTHROPIC_API_KEY;
    this.useGemini = !this.useAnthropic && !!env.GEMINI_API_KEY;

    if (this.useAnthropic) {
      this.logger.log('AI provider: Anthropic');

      this.anthropicProvider = createAnthropic({
        apiKey: env.ANTHROPIC_API_KEY!,
      });
      this.googleProvider = null;
      this.openRouterProvider = null;
    } else if (this.useGemini) {
      this.logger.log('AI provider: Google Gemini');
      this.googleProvider = createGoogleGenerativeAI({
        apiKey: env.GEMINI_API_KEY!,
      });
      this.anthropicProvider = null;
      this.openRouterProvider = null;
    } else {
      this.logger.log(
        'AI provider: OpenRouter (Anthropic/Gemini keys not set)',
      );
      this.openRouterProvider = createOpenRouter({
        apiKey: env.OPENROUTER_API_KEY ?? '',
        baseURL: env.OPENROUTER_BASE_URL,
        compatibility: 'strict',
        appUrl: 'https://skillbridge.hng14.com',
        appName: 'SkillBridge CredLane',
        headers: {
          'HTTP-Referer': 'https://skillbridge.hng14.com',
          'X-Title': 'SkillBridge CredLane',
        },
      }) as AiProviderFactory;
      this.anthropicProvider = null;
      this.googleProvider = null;

      if (!env.OPENROUTER_API_KEY) {
        this.logger.warn(
          'Neither ANTHROPIC_API_KEY, GEMINI_API_KEY, nor OPENROUTER_API_KEY is configured; AI endpoints will be unavailable',
        );
      }
    }
  }

  private resolveModel(useWebSearch = false): LanguageModel {
    if (this.useAnthropic) {
      return this.anthropicProvider!(env.ANTHROPIC_MODEL);
    }

    if (this.useGemini) {
      return this.googleProvider!(env.GEMINI_MODEL);
    }

    return this.openRouterProvider!(env.OPENROUTER_MODEL, {
      structuredOutputs: { strict: false },
      plugins: useWebSearch
        ? [{ id: 'web', max_results: 5 }, { id: 'response-healing' }]
        : [{ id: 'response-healing' }],
    });
  }

  async chat<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodType<T>,
    temperature = 0.2,
    useWebSearch = false,
  ): Promise<T> {
    if (!this.useAnthropic && !this.useGemini && !env.OPENROUTER_API_KEY) {
      throw new ServiceUnavailableException('AI service is not configured');
    }

    try {
      const result = await generateObject({
        model: this.resolveModel(useWebSearch),
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
        `AI call failed: status=${error.statusCode ?? 'unknown'}`,
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
      return `AI call failed: ${error.name}: ${error.message}`;
    }

    return `AI call failed: ${String(error)}`;
  }
}
