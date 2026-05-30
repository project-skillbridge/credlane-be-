import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { AssessmentAttempt, AssessmentResult } from '../assessments/entities';
import { ResourceGenerationService } from '../ai/resource-generation.service';
import {
  AiLearningResource,
  ScoreThresholdGroup,
} from './entities/ai-learning-resource.entity';
import { ErrorMessages } from '../../shared';
import { AI_RESOURCE_CONSTANTS } from './ai-resources.constants';

interface GenerationLock {
  promise: Promise<AiLearningResource>;
  isBackground: boolean;
}

@Injectable()
export class AiResourcesService {
  private readonly logger = new Logger(AiResourcesService.name);
  private generationLocks = new Map<string, GenerationLock>();

  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepo: Repository<TalentProfile>,

    @InjectRepository(AssessmentAttempt)
    private readonly attemptRepo: Repository<AssessmentAttempt>,

    @InjectRepository(AssessmentResult)
    private readonly resultRepo: Repository<AssessmentResult>,

    @InjectRepository(AiLearningResource)
    private readonly aiLearningResourceRepo: Repository<AiLearningResource>,

    private readonly resourceGenerationService: ResourceGenerationService,
  ) {}

  /**
   * Warm the cache for a given track. Called in the background after
   * a user selects their track during onboarding — so that when they
   * navigate to the resources page, data is already cached.
   */
  async warmCache(track: string): Promise<void> {
    const trackKey = track.toLowerCase().trim();
    // New users have no assessment, so warm the "general" threshold
    const thresholdGroup = ScoreThresholdGroup.GENERAL;
    const cacheKey = `${trackKey}-${thresholdGroup}`;

    const existing = await this.aiLearningResourceRepo.findOne({
      where: { track: trackKey, threshold_group: thresholdGroup },
    });
    if (existing) return; // already cached

    if (this.generationLocks.has(cacheKey)) return; // already generating

    this.logger.log(
      `Cache warming: generating resources for track=${trackKey} threshold=${thresholdGroup}`,
    );

    const generationPromise = this.generateAndSaveResources(
      trackKey,
      thresholdGroup,
      AI_RESOURCE_CONSTANTS.BACKGROUND_TIMEOUT_MS,
    );
    const localLock: GenerationLock = {
      promise: generationPromise,
      isBackground: true,
    };
    this.generationLocks.set(cacheKey, localLock);

    try {
      await generationPromise;
      this.logger.log(
        `Cache warming complete: track=${trackKey} threshold=${thresholdGroup}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Cache warming failed: ${message}`);
    } finally {
      if (this.generationLocks.get(cacheKey) === localLock) {
        this.generationLocks.delete(cacheKey);
      }
    }
  }

  async getResourcesForUser(userId: string): Promise<AiLearningResource> {
    // 1. Fetch talent profile
    const profile = await this.talentProfileRepo.findOne({
      where: { user_id: userId },
    });
    if (!profile) {
      throw new NotFoundException(ErrorMessages.AI_RESOURCES.PROFILE_NOT_FOUND);
    }

    if (!profile.track) {
      throw new UnprocessableEntityException(
        ErrorMessages.SKILL_ASSESSMENT.TRACK_MISSING,
      );
    }

    // 2. Fetch user's latest completed assessment attempt
    const latestAttempt = await this.attemptRepo.findOne({
      where: {
        talent_profile_id: profile.id,
        completed_at: Not(IsNull()),
      },
      order: {
        completed_at: 'DESC',
      },
    });

    // 3. Determine threshold group based on assessment result (or general if none)
    let thresholdGroup: ScoreThresholdGroup;

    if (!latestAttempt) {
      // No assessment completed — serve general resources for the track
      thresholdGroup = ScoreThresholdGroup.GENERAL;
    } else {
      const result = await this.resultRepo.findOne({
        where: { attempt_id: latestAttempt.id },
      });

      if (
        !result ||
        result.percentage === null ||
        result.percentage === undefined
      ) {
        // Result not yet scored — serve general resources
        thresholdGroup = ScoreThresholdGroup.GENERAL;
      } else {
        // 4. Map score to threshold group
        const percentage = result.percentage;
        if (percentage < 50) {
          thresholdGroup = ScoreThresholdGroup.BELOW_50;
        } else if (percentage <= 75) {
          thresholdGroup = ScoreThresholdGroup.BETWEEN_50_75;
        } else {
          thresholdGroup = ScoreThresholdGroup.ABOVE_75;
        }
      }
    }

    const trackKey = profile.track.toLowerCase().trim();
    const cacheKey = `${trackKey}-${thresholdGroup}`;

    // 5. Look up in the database cache
    const cached = await this.aiLearningResourceRepo.findOne({
      where: {
        track: trackKey,
        threshold_group: thresholdGroup,
      },
    });

    if (cached) {
      this.logger.log(
        `Cache hit for resources: track=${trackKey} threshold=${thresholdGroup}`,
      );
      // Return a randomized subset of the massive cached pool
      cached.resources = this.getRandomSubset(
        cached.resources,
        AI_RESOURCE_CONSTANTS.RANDOM_RESOURCE_RETURN_COUNT,
      );
      cached.videos = this.getRandomSubset(
        cached.videos,
        AI_RESOURCE_CONSTANTS.RANDOM_VIDEO_RETURN_COUNT,
      );
      return cached;
    }

    // 6. Check for in-flight generation to prevent concurrent LLM calls
    const existingLock = this.generationLocks.get(cacheKey);
    if (existingLock && !existingLock.isBackground) {
      // Another inline request is already generating — join it
      this.logger.log(
        `Cache miss but inline generation in-flight for: track=${trackKey} threshold=${thresholdGroup}. Awaiting existing promise...`,
      );
      const generatedRecord = await existingLock.promise;
      const clone = { ...generatedRecord };
      clone.resources = this.getRandomSubset(
        clone.resources,
        AI_RESOURCE_CONSTANTS.RANDOM_RETURN_COUNT,
      );
      clone.videos = this.getRandomSubset(
        clone.videos,
        AI_RESOURCE_CONSTANTS.RANDOM_RETURN_COUNT,
      );
      return clone;
    }

    if (existingLock?.isBackground) {
      // Background warming is in-flight — race it against the inline timeout
      // so the user never waits longer than INLINE_TIMEOUT_MS
      this.logger.log(
        `Cache miss, background generation in-flight for: track=${trackKey} threshold=${thresholdGroup}. Racing with inline timeout...`,
      );
      let timeoutId: ReturnType<typeof setTimeout>;
      const inlineDeadline = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('inline_timeout')),
          AI_RESOURCE_CONSTANTS.INLINE_TIMEOUT_MS,
        );
      });
      try {
        const generatedRecord = await Promise.race([
          existingLock.promise,
          inlineDeadline,
        ]);
        clearTimeout(timeoutId!);
        const clone = { ...generatedRecord };
        clone.resources = this.getRandomSubset(
          clone.resources,
          AI_RESOURCE_CONSTANTS.RANDOM_RETURN_COUNT,
        );
        clone.videos = this.getRandomSubset(
          clone.videos,
          AI_RESOURCE_CONSTANTS.RANDOM_RETURN_COUNT,
        );
        return clone;
      } catch (err) {
        if (err instanceof Error && err.message === 'inline_timeout') {
          this.logger.warn(
            `Background generation did not finish within inline timeout for: track=${trackKey} threshold=${thresholdGroup}. Starting own inline generation...`,
          );
        } else {
          this.logger.warn(
            `Background generation failed for track=${trackKey} threshold=${thresholdGroup}. Starting inline generation... Error: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        // Fall through to start own inline generation below
      }
    }

    // 7. Invoke AI resource generation and lock
    this.logger.log(
      `Cache miss for resources: track=${trackKey} threshold=${thresholdGroup}. Generating via AI...`,
    );
    const generationPromise = this.generateAndSaveResources(
      trackKey,
      thresholdGroup,
      AI_RESOURCE_CONSTANTS.INLINE_TIMEOUT_MS,
    );
    const localLock: GenerationLock = {
      promise: generationPromise,
      isBackground: false,
    };
    this.generationLocks.set(cacheKey, localLock);

    try {
      const savedRecord = await generationPromise;
      const clone = { ...savedRecord };
      clone.resources = this.getRandomSubset(
        clone.resources,
        AI_RESOURCE_CONSTANTS.RANDOM_RETURN_COUNT,
      );
      clone.videos = this.getRandomSubset(
        clone.videos,
        AI_RESOURCE_CONSTANTS.RANDOM_RETURN_COUNT,
      );
      return clone;
    } finally {
      if (this.generationLocks.get(cacheKey) === localLock) {
        this.generationLocks.delete(cacheKey);
      }
    }
  }

  private async generateAndSaveResources(
    trackKey: string,
    thresholdGroup: ScoreThresholdGroup,
    timeoutMs?: number,
  ): Promise<AiLearningResource> {
    const generated = await this.resourceGenerationService.generate(
      trackKey,
      thresholdGroup,
      timeoutMs,
    );

    const newRecord = this.aiLearningResourceRepo.create({
      track: trackKey,
      threshold_group: thresholdGroup,
      banner_title: generated.banner_title,
      banner_description: generated.banner_description,
      resources: generated.resources,
      videos: generated.videos,
    });

    try {
      return await this.aiLearningResourceRepo.save(newRecord);
    } catch (error) {
      this.logger.warn(
        `Failed to save generated resources to database due to potential conflict: ${String(
          error,
        )}. Retrying read...`,
      );
      // If another request concurrently saved it before our insert
      const existing = await this.aiLearningResourceRepo.findOne({
        where: {
          track: trackKey,
          threshold_group: thresholdGroup,
        },
      });
      if (existing) {
        return existing;
      }
      throw error;
    }
  }

  private getRandomSubset<T>(items: T[], count: number): T[] {
    if (!items || items.length === 0) return [];
    const shuffled = [...items].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
}
