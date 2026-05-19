import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { env } from '../../config/env';

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL,
      defaultHeaders: {
        'HTTP-Referer': 'https://skillbridge.hng14.com',
        'X-Title': 'SkillBridge CredLane',
      },
    });
    this.model = env.OPENROUTER_MODEL;
  }

  /**
   * Calls the model and returns the parsed JSON response.
   * Always enforces response_format: json_object.
   */
  async chat<T>(
    systemPrompt: string,
    userPrompt: string,
    temperature = 0.2,
  ): Promise<T> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from model');
      }

      return JSON.parse(content) as T;
    } catch (error) {
      this.logger.error(`OpenRouter call failed: ${String(error)}`);
      throw new ServiceUnavailableException('AI service temporarily unavailable');
    }
  }
}
