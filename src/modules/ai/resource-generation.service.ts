import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from './openrouter.service';
import { UrlResolutionService } from './url-resolution.service';
import { aiResourcesPayloadSchema } from './ai.schemas';
import { AiResourcesPayload } from './ai.types';
import { AI_RESOURCE_CONSTANTS } from '../ai-resources/ai-resources.constants';

const SYSTEM_PROMPT = `You are a professional career advisor, mentor, and learning curator.
Your task is to recommend high-quality, practical learning resources (articles, documentations, courses, and videos) to help candidates level up their skills.
Focus on generating accurate TITLES and DESCRIPTIONS that clearly identify real, well-known resources from recognizable platforms (e.g., MDN Web Docs, freeCodeCamp, official docs, YouTube tutorials, Coursera, etc.).
For the URL field, provide your best guess of the URL — it will be verified and replaced by an external search API after generation.
Return ONLY valid JSON matching the schema — do not wrap in markdown unless requested by the model driver, and output no conversational text.`;

@Injectable()
export class ResourceGenerationService {
  private readonly logger = new Logger(ResourceGenerationService.name);

  constructor(
    private readonly openRouter: OpenRouterService,
    private readonly urlResolution: UrlResolutionService,
  ) {}

  async generate(
    track: string,
    thresholdGroup: string,
    timeoutMs?: number,
  ): Promise<AiResourcesPayload> {
    let focusGuide: string;
    if (thresholdGroup === 'general') {
      focusGuide =
        'The candidate has not yet completed an assessment. Provide a well-rounded mix of beginner-to-intermediate resources covering fundamentals, best practices, and practical project-building tutorials to help them get started and grow in their track.';
    } else if (thresholdGroup === 'below_50') {
      focusGuide =
        'The candidate scored below 50%. Focus heavily on foundational, beginner-friendly topics, basic setup guides, tutorials, and fundamental concepts to help them build a strong base.';
    } else if (thresholdGroup === 'between_50_75') {
      focusGuide =
        'The candidate scored between 50% and 75%. Focus on intermediate topics, best practices, common architectures, debugging, and practical project-building tutorials.';
    } else if (thresholdGroup === 'above_75') {
      focusGuide =
        'The candidate scored above 75%. Focus on advanced/expert topics, system design, performance optimization, advanced patterns, and deep-dive technical resources.';
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
      "title": "Clear, concise resource title — use the EXACT title of a real resource you know",
      "description": "Short summary of what this article/course covers.",
      "url": "https://example.com/your-best-guess-url",
      "duration": "5 min read" or "2 hours",
      "type": "article" or "course"
    }
  ],
  "videos": [
    // GENERATE AT LEAST ${AI_RESOURCE_CONSTANTS.POOL_GENERATION_COUNT} ITEMS HERE!
    {
      "title": "Clear, concise video title — use the EXACT title of a real YouTube video you know",
      "description": "Short summary of what this video/tutorial covers. Include the channel name if possible.",
      "url": "https://youtube.com/watch?v=placeholder",
      "duration": "15 mins" or "1 hour",
      "type": "video"
    }
  ]
}

Rules:
- Generate 8 to 10 items for "resources" and 5 to 8 items for "videos".
- Make resources directly relevant to the ${track} track and the indicated depth (${thresholdGroup}).
- Focus on providing ACCURATE TITLES of real, well-known resources. The titles will be used to search for correct URLs via external APIs.
- Include the creator/channel name in video descriptions (e.g., "by Traversy Media", "by Fireship").
- For articles, reference well-known platforms: MDN, freeCodeCamp, dev.to, official docs, CSS-Tricks, etc.
`.trim();

    const payload = await this.openRouter.chat(
      SYSTEM_PROMPT,
      userPrompt,
      aiResourcesPayloadSchema,
      0.6,
      false, // no web search needed — we verify URLs externally
      timeoutMs,
    );

    // Resolve URLs via YouTube Data API and Google Custom Search API
    this.logger.log(
      `Resolving URLs for ${payload.resources.length} resources and ${payload.videos.length} videos...`,
    );

    const [resolvedResources, resolvedVideos] = await Promise.all([
      this.urlResolution.resolveAllUrls(payload.resources),
      this.urlResolution.resolveAllUrls(payload.videos),
    ]);

    // Move any resource items that were reclassified as 'video' into the videos array
    const finalResources = resolvedResources.filter(
      (r) => (r.type as string) !== 'video',
    );
    const movedToVideos = resolvedResources
      .filter((r) => (r.type as string) === 'video')
      .map((r) => ({ ...r, type: 'video' as const }));

    return {
      ...payload,
      resources: finalResources,
      videos: [...resolvedVideos, ...movedToVideos],
    };
  }
}
