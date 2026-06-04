import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { ResourceGenerationService } from '../ai/resource-generation.service';
import { AiLearningResource } from './entities/ai-learning-resource.entity';
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

    @InjectRepository(AiLearningResource)
    private readonly aiLearningResourceRepo: Repository<AiLearningResource>,

    private readonly resourceGenerationService: ResourceGenerationService,
  ) {}

  /**
   * Warm the cache for a given track and level. Called in the background after
   * onboarding (level='general'), personal assessment (level=claimedLevel),
   * and skill assessment pass (level=validatedLevel).
   */
  async warmCache(track: string, level: string): Promise<void> {
    const trackKey = track.toLowerCase().trim();
    const levelKey = level.toLowerCase().trim();
    const cacheKey = `${trackKey}-${levelKey}`;

    const existing = await this.aiLearningResourceRepo.findOne({
      where: { track: trackKey, level: levelKey },
    });
    if (existing) return; // already cached

    if (this.generationLocks.has(cacheKey)) return; // already generating

    this.logger.log(
      `Cache warming: generating resources for track=${trackKey} level=${levelKey}`,
    );

    const generationPromise = this.generateAndSaveResources(
      trackKey,
      levelKey,
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
        `Cache warming complete: track=${trackKey} level=${levelKey}`,
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

    // 2. Determine level: validated_level > claimed_level > 'general'
    const level = (
      profile.validated_level ??
      profile.claimed_level ??
      'general'
    )
      .toLowerCase()
      .trim();

    const trackKey = profile.track.toLowerCase().trim();
    const cacheKey = `${trackKey}-${level}`;

    // 3. Look up in the database cache
    const cached = await this.aiLearningResourceRepo.findOne({
      where: {
        track: trackKey,
        level,
      },
    });

    if (cached) {
      this.logger.log(
        `Cache hit for resources: track=${trackKey} level=${level}`,
      );
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

    // 4. Check for in-flight generation to prevent concurrent LLM calls
    const existingLock = this.generationLocks.get(cacheKey);
    if (existingLock && !existingLock.isBackground) {
      this.logger.log(
        `Cache miss but inline generation in-flight for: track=${trackKey} level=${level}. Awaiting existing promise...`,
      );
      const generatedRecord = await existingLock.promise;
      return this.returnSubset(generatedRecord);
    }

    if (existingLock?.isBackground) {
      this.logger.log(
        `Cache miss, background generation in-flight for: track=${trackKey} level=${level}. Racing with inline timeout...`,
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
        return this.returnSubset(generatedRecord);
      } catch (err) {
        if (err instanceof Error && err.message === 'inline_timeout') {
          this.logger.warn(
            `Background generation did not finish within inline timeout for: track=${trackKey} level=${level}. Starting own inline generation...`,
          );
        } else {
          this.logger.warn(
            `Background generation failed for track=${trackKey} level=${level}. Starting inline generation... Error: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    // 5. Invoke AI resource generation and lock
    this.logger.log(
      `Cache miss for resources: track=${trackKey} level=${level}. Generating via AI...`,
    );
    const generationPromise = this.generateAndSaveResources(
      trackKey,
      level,
      AI_RESOURCE_CONSTANTS.INLINE_TIMEOUT_MS,
    );
    const localLock: GenerationLock = {
      promise: generationPromise,
      isBackground: false,
    };
    this.generationLocks.set(cacheKey, localLock);

    try {
      const savedRecord = await generationPromise;
      return this.returnSubset(savedRecord);
    } finally {
      if (this.generationLocks.get(cacheKey) === localLock) {
        this.generationLocks.delete(cacheKey);
      }
    }
  }

  private async generateAndSaveResources(
    trackKey: string,
    level: string,
    timeoutMs?: number,
  ): Promise<AiLearningResource> {
    const generated = await this.resourceGenerationService.generate(
      trackKey,
      level,
      timeoutMs,
    );

    // Resolve URLs inline so no user ever receives guessed/broken links
    const resolved =
      await this.resourceGenerationService.resolveUrls(generated);

    const newRecord = this.aiLearningResourceRepo.create({
      track: trackKey,
      level,
      banner_title: resolved.banner_title,
      banner_description: resolved.banner_description,
      resources: resolved.resources,
      videos: resolved.videos,
    });

    try {
      return await this.aiLearningResourceRepo.save(newRecord);
    } catch (error) {
      this.logger.warn(
        `Failed to save generated resources to database due to potential conflict: ${String(
          error,
        )}. Retrying read...`,
      );
      const existing = await this.aiLearningResourceRepo.findOne({
        where: {
          track: trackKey,
          level,
        },
      });
      if (existing) {
        return existing;
      }
      throw error;
    }
  }

  /** Pick a random subset from the saved record. */
  private returnSubset(record: AiLearningResource): AiLearningResource {
    const clone = { ...record };
    clone.resources = this.getRandomSubset(
      record.resources,
      AI_RESOURCE_CONSTANTS.RANDOM_RESOURCE_RETURN_COUNT,
    );
    clone.videos = this.getRandomSubset(
      record.videos,
      AI_RESOURCE_CONSTANTS.RANDOM_VIDEO_RETURN_COUNT,
    );
    return clone;
  }

  private getRandomSubset<T>(items: T[], count: number): T[] {
    if (!items || items.length === 0) return [];
    const shuffled = [...items].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
}
