import { Injectable } from '@nestjs/common';
import { OpenRouterService } from './openrouter.service';
import { aiResourcesPayloadSchema } from './ai.schemas';
import { AiResourcesPayload } from './ai.types';
import { AI_RESOURCE_CONSTANTS } from '../ai-resources/ai-resources.constants';

const SYSTEM_PROMPT = `You are a professional career advisor, mentor, and learning curator.
Your task is to perform deep web research to recommend high-quality, practical learning resources (articles, documentations, courses, and videos) to help candidates level up their skills.
CRITICAL: You MUST use your web search capabilities to find REAL, ACTIVE, and highly recognizable learning platforms (e.g., MDN Web Docs, freeCodeCamp, official docs, YouTube tutorials, Coursera, etc.).
NEVER generate dummy, placeholder, or hallucinated URLs. Every URL must be a real, accessible link discovered through your web search.
Return ONLY valid JSON matching the schema — do not wrap in markdown unless requested by the model driver, and output no conversational text.`;

@Injectable()
export class ResourceGenerationService {
  constructor(private readonly openRouter: OpenRouterService) {}

  async generate(track: string, thresholdGroup: string): Promise<AiResourcesPayload> {
    let focusGuide: string;
    if (thresholdGroup === 'below_50') {
      focusGuide = 'The candidate scored below 50%. Focus heavily on foundational, beginner-friendly topics, basic setup guides, tutorials, and fundamental concepts to help them build a strong base.';
    } else if (thresholdGroup === 'between_50_75') {
      focusGuide = 'The candidate scored between 50% and 75%. Focus on intermediate topics, best practices, common architectures, debugging, and practical project-building tutorials.';
    } else if (thresholdGroup === 'above_75') {
      focusGuide = 'The candidate scored above 75%. Focus on advanced/expert topics, system design, performance optimization, advanced patterns, and deep-dive technical resources.';
    } else {
      throw new Error(`Unknown threshold group: ${thresholdGroup}`);
    }

    const userPrompt = `
Track: ${track}
Score Threshold: ${thresholdGroup}

Focus for recommendations:
${focusGuide}

Please generate a LARGE POOL of learning resources and return them in this JSON format:
{
  "banner_title": "A short motivational title (e.g., 'Life as a Frontend Developer' or 'Mastering Product Management')",
  "banner_description": "A short summary encouraging the candidate to review these resources to level up in their track.",
  "resources": [
    // GENERATE AT LEAST ${AI_RESOURCE_CONSTANTS.POOL_GENERATION_COUNT} ITEMS HERE!
    {
      "title": "Clear, concise resource title",
      "description": "Short summary of what this article/course covers.",
      "url": "https://example.com/actual-path",
      "duration": "5 min read" or "2 hours",
      "type": "article" or "course"
    }
  ],
  "videos": [
    // GENERATE AT LEAST ${AI_RESOURCE_CONSTANTS.POOL_GENERATION_COUNT} ITEMS HERE!
    {
      "title": "Clear, concise video title",
      "description": "Short summary of what this video/tutorial covers.",
      "url": "https://youtube.com/watch?v=someVideoId",
      "duration": "15 mins" or "1 hour",
      "type": "video"
    }
  ]
}

Rules:
- Generate 8 to 10 items for "resources" and 5 to 8 items for "videos".
- Make resources directly relevant to the ${track} track and the indicated depth (${thresholdGroup}).
- Ensure URLs look like real learning resources (e.g., MDN, freeCodeCamp, official docs, dev.to, YouTube).
`.trim();

    return this.openRouter.chat(
      SYSTEM_PROMPT,
      userPrompt,
      aiResourcesPayloadSchema,
      0.6,
      true, 
    );
  }
}
