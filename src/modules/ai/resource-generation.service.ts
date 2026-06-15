import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from './openrouter.service';
import { UrlResolutionService } from './url-resolution.service';
import { aiResourcesPayloadSchema } from './ai.schemas';
import { AiResourcesPayload } from './ai.types';
import {
  buildResourceGenerationPrompt,
  RESOURCE_GENERATION_SYSTEM_PROMPT,
} from './prompt-builders';

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

    const userPrompt = buildResourceGenerationPrompt(track, level, focusGuide);

    const payload = await this.openRouter.chat(
      RESOURCE_GENERATION_SYSTEM_PROMPT,
      userPrompt,
      aiResourcesPayloadSchema,
      0.6,
      false, // no web search needed — we verify URLs externally
      timeoutMs,
      'resource_generation',
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
