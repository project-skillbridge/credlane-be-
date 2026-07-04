import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { APICallError, generateText, LanguageModel, Output } from 'ai';
import { z } from 'zod';
import { env } from '../../config/env';
import { AiUsageLog } from './ai-usage-log.entity';

type AiProviderFactory = (modelId: string, options?: unknown) => LanguageModel;

export interface AiUsageMetrics {
  provider: string | null;
  modelId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  durationMs: number;
}

export interface AiChatResult<T> {
  output: T;
  metrics: AiUsageMetrics;
}

const isNvidiaBaseUrl = (baseUrl: string) =>
  /(^https?:\/\/)?(integrate\.)?api\.nvidia\.com(\/|$)/i.test(baseUrl);

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly maxRetries = 4;
  private readonly defaultTimeoutMs = 300_000; // 5 minutes
  private readonly useAnthropic: boolean;
  private readonly useGemini: boolean;
  private readonly useNvidia: boolean;

  private readonly anthropicProvider: AiProviderFactory | null;
  private readonly googleProvider: AiProviderFactory | null;
  private readonly openAiCompatibleProvider: AiProviderFactory | null;
  private readonly openRouterProvider: AiProviderFactory | null;

  constructor(
    @InjectRepository(AiUsageLog)
    private readonly aiUsageLogRepo: Repository<AiUsageLog>,
  ) {
    this.useAnthropic = !!env.ANTHROPIC_API_KEY;
    this.useGemini = !this.useAnthropic && !!env.GEMINI_API_KEY;
    this.useNvidia =
      !this.useAnthropic &&
      !this.useGemini &&
      (env.OPENROUTER_PROVIDER === 'nvidia' ||
        isNvidiaBaseUrl(env.OPENROUTER_BASE_URL));

    if (this.useAnthropic) {
      this.logger.log('AI provider: Anthropic');

      this.anthropicProvider = createAnthropic({
        apiKey: env.ANTHROPIC_API_KEY!,
      });
      this.googleProvider = null;
      this.openAiCompatibleProvider = null;
      this.openRouterProvider = null;
    } else if (this.useGemini) {
      this.logger.log('AI provider: Google Gemini');
      this.googleProvider = createGoogleGenerativeAI({
        apiKey: env.GEMINI_API_KEY!,
      });
      this.anthropicProvider = null;
      this.openAiCompatibleProvider = null;
      this.openRouterProvider = null;
    } else if (this.useNvidia) {
      this.logger.log('AI provider: NVIDIA (OpenAI-compatible)');
      const openAiProvider = createOpenAI({
        apiKey: env.OPENROUTER_API_KEY ?? '',
        baseURL: env.OPENROUTER_BASE_URL,
      });
      this.openAiCompatibleProvider = (modelId: string) =>
        openAiProvider.chat(modelId);
      this.anthropicProvider = null;
      this.googleProvider = null;
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
      this.openAiCompatibleProvider = null;

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

    if (this.useNvidia) {
      return this.openAiCompatibleProvider!(env.OPENROUTER_MODEL);
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
    timeoutMs?: number,
    label?: string,
  ): Promise<T> {
    const result = await this.chatWithMeta(
      systemPrompt,
      userPrompt,
      schema,
      temperature,
      useWebSearch,
      timeoutMs,
      label,
    );
    return result.output;
  }

  async chatWithMeta<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodType<T>,
    temperature = 0.2,
    useWebSearch = false,
    timeoutMs?: number,
    label?: string,
  ): Promise<AiChatResult<T>> {
    if (!this.useAnthropic && !this.useGemini && !env.OPENROUTER_API_KEY) {
      throw new ServiceUnavailableException('AI service is not configured');
    }

    const timeout = timeoutMs ?? this.defaultTimeoutMs;
    const startedAt = Date.now();

    try {
      if (this.useNvidia) {
        const result = await generateText({
          model: this.resolveModel(useWebSearch),
          temperature,
          maxRetries: this.maxRetries,
          system: systemPrompt,
          prompt: `${userPrompt}\n\nReturn valid JSON only.`,
          abortSignal: AbortSignal.timeout(timeout),
        });
        const output = this.parseJsonResponse(result.text, schema);
        const metrics = this.extractUsageMetrics(
          result,
          Date.now() - startedAt,
        );
        this.logUsage(label, metrics);
        return { output, metrics };
      }

      const result = await generateText({
        model: this.resolveModel(useWebSearch),
        output: Output.object({ schema }),
        temperature,
        maxRetries: this.maxRetries,
        system: systemPrompt,
        prompt: userPrompt,
        abortSignal: AbortSignal.timeout(timeout),
      });
      const metrics = this.extractUsageMetrics(result, Date.now() - startedAt);
      this.logUsage(label, metrics);
      return { output: result.output, metrics };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        this.logger.error(`AI call timed out after ${timeout}ms`);
        throw new ServiceUnavailableException('AI service request timed out');
      }
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

  private extractUsageMetrics(
    result: {
      usage?: Record<string, unknown>;
      providerMetadata?: Record<string, unknown>;
      response?: { body?: unknown; modelId?: string | null };
    },
    durationMs: number,
  ): AiUsageMetrics {
    const usage = result.usage ?? {};
    const rawUsage = (usage.raw as Record<string, unknown> | undefined) ?? {};
    const providerMetadata = result.providerMetadata ?? {};
    const openRouterMetadata = (providerMetadata.openrouter ?? {}) as Record<
      string,
      unknown
    >;
    const responseBody =
      result.response?.body &&
      typeof result.response.body === 'object' &&
      !Array.isArray(result.response.body)
        ? (result.response.body as Record<string, unknown>)
        : {};

    return {
      provider: this.readString(
        openRouterMetadata.provider ?? responseBody.provider,
      ),
      modelId: this.readString(result.response?.modelId ?? responseBody.model),
      inputTokens: this.readNumber(usage.inputTokens ?? rawUsage.prompt_tokens),
      outputTokens: this.readNumber(
        usage.outputTokens ?? rawUsage.completion_tokens,
      ),
      totalTokens: this.readNumber(usage.totalTokens ?? rawUsage.total_tokens),
      costUsd: this.readNumber(rawUsage.cost),
      durationMs,
    };
  }

  private logUsage(label: string | undefined, metrics: AiUsageMetrics): void {
    const cost = metrics.costUsd == null ? 'n/a' : metrics.costUsd.toFixed(8);
    const tag = label ?? 'ai_call';
    this.logger.log(
      `AI usage label=${tag} provider=${metrics.provider ?? 'unknown'} model=${metrics.modelId ?? 'unknown'} input_tokens=${metrics.inputTokens ?? 'n/a'} output_tokens=${metrics.outputTokens ?? 'n/a'} total_tokens=${metrics.totalTokens ?? 'n/a'} cost_usd=${cost} duration_ms=${metrics.durationMs}`,
    );
    void this.aiUsageLogRepo
      .save(
        this.aiUsageLogRepo.create({
          tag,
          provider: metrics.provider,
          model_id: metrics.modelId,
          input_tokens: metrics.inputTokens,
          output_tokens: metrics.outputTokens,
          total_tokens: metrics.totalTokens,
          cost_usd: metrics.costUsd,
          duration_ms: metrics.durationMs,
        }),
      )
      .catch((err: unknown) =>
        this.logger.error(
          `Failed to persist AI usage log: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
  }

  private readNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private parseJsonResponse<T>(text: string, schema: z.ZodType<T>): T {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1]?.trim() ?? trimmed;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');

    if (start === -1 || end === -1 || end < start) {
      throw new Error(`No JSON object found in model response:\n${text}`);
    }

    return schema.parse(JSON.parse(candidate.slice(start, end + 1)));
  }
}
