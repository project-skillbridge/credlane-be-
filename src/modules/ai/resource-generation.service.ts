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
    level: string,
    timeoutMs?: number,
  ): Promise<AiResourcesPayload> {
    let focusGuide: string;
    if (level === 'general') {
      focusGuide =
        'The candidate has not yet completed an assessment. Provide a well-rounded mix of beginner-to-intermediate resources covering fundamentals, best practices, and practical tutorials to help them get started and grow in their track.';
    } else if (level === 'junior') {
      focusGuide =
        'The candidate is at a junior level. Focus on foundational topics, introductory guides, core concepts, and beginner-friendly tutorials that help them build a strong base in their track.';
    } else if (level === 'mid') {
      focusGuide =
        'The candidate is at a mid level. Focus on intermediate topics, industry best practices, real-world workflows, problem-solving strategies, and practical project-based learning.';
    } else if (level === 'senior') {
      focusGuide =
        'The candidate is at a senior level. Focus on advanced strategies, leadership in their domain, complex problem-solving, optimization techniques, and deep-dive resources for mastery.';
    } else if (level === 'expert') {
      focusGuide =
        'The candidate is at an expert level. Focus on cutting-edge trends, thought leadership, scaling strategies, cross-functional excellence, and resources that push the boundaries of their field.';
    } else {
      throw new Error(`Unknown level: ${level}`);
    }

    const userPrompt = `
Track: ${track}
Level: ${level}

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
- Generate at least ${AI_RESOURCE_CONSTANTS.POOL_GENERATION_COUNT} items for "resources" and at least ${AI_RESOURCE_CONSTANTS.POOL_GENERATION_COUNT} items for "videos".
- Make resources directly relevant to the ${track} track and the indicated depth (${level}).
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

    this.logger.log(
      `AI generated ${payload.resources.length} resources and ${payload.videos.length} videos for track=${track} level=${level}`,
    );

    return payload;
  }

  /**
   * Resolve AI-generated placeholder URLs via YouTube Data API and Serper.
   * Called in the background after the record is saved to DB.
   */
  async resolveUrls(payload: AiResourcesPayload): Promise<AiResourcesPayload> {
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
