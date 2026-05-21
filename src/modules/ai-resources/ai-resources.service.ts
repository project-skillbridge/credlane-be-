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

@Injectable()
export class AiResourcesService {
  private readonly logger = new Logger(AiResourcesService.name);
  private generationLocks = new Map<string, Promise<AiLearningResource>>();

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

    if (!latestAttempt) {
      throw new UnprocessableEntityException(
        ErrorMessages.AI_RESOURCES.NO_ASSESSMENT_SCORES,
      );
    }

    // 3. Fetch corresponding assessment result containing the percentage score
    const result = await this.resultRepo.findOne({
      where: { attempt_id: latestAttempt.id },
    });

    if (!result || result.percentage === null || result.percentage === undefined) {
      throw new UnprocessableEntityException(
        ErrorMessages.AI_RESOURCES.NO_ASSESSMENT_SCORES,
      );
    }

    // 4. Map score to threshold group
    const percentage = result.percentage;
    let thresholdGroup: ScoreThresholdGroup;
    if (percentage < 50) {
      thresholdGroup = ScoreThresholdGroup.BELOW_50;
    } else if (percentage <= 75) {
      thresholdGroup = ScoreThresholdGroup.BETWEEN_50_75;
    } else {
      thresholdGroup = ScoreThresholdGroup.ABOVE_75;
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
      cached.resources = this.getRandomSubset(cached.resources, AI_RESOURCE_CONSTANTS.RANDOM_RETURN_COUNT);
      cached.videos = this.getRandomSubset(cached.videos, AI_RESOURCE_CONSTANTS.RANDOM_RETURN_COUNT);
      return cached;
    }

    // 6. Check for in-flight generation to prevent concurrent LLM calls
    if (this.generationLocks.has(cacheKey)) {
      this.logger.log(
        `Cache miss but generation in-flight for: track=${trackKey} threshold=${thresholdGroup}. Awaiting existing promise...`,
      );
      const generatedRecord = await this.generationLocks.get(cacheKey)!;
      const clone = { ...generatedRecord };
      clone.resources = this.getRandomSubset(clone.resources, AI_RESOURCE_CONSTANTS.RANDOM_RETURN_COUNT);
      clone.videos = this.getRandomSubset(clone.videos, AI_RESOURCE_CONSTANTS.RANDOM_RETURN_COUNT);
      return clone;
    }

    // 7. Invoke AI resource generation and lock
    this.logger.log(
      `Cache miss for resources: track=${trackKey} threshold=${thresholdGroup}. Generating via AI...`,
    );
    const generationPromise = this.generateAndSaveResources(trackKey, thresholdGroup);
    this.generationLocks.set(cacheKey, generationPromise);

    try {
      const savedRecord = await generationPromise;
      const clone = { ...savedRecord };
      clone.resources = this.getRandomSubset(clone.resources, AI_RESOURCE_CONSTANTS.RANDOM_RETURN_COUNT);
      clone.videos = this.getRandomSubset(clone.videos, AI_RESOURCE_CONSTANTS.RANDOM_RETURN_COUNT);
      return clone;
    } finally {
      this.generationLocks.delete(cacheKey);
    }
  }

  private async generateAndSaveResources(
    trackKey: string,
    thresholdGroup: ScoreThresholdGroup,
  ): Promise<AiLearningResource> {
    const generated = await this.resourceGenerationService.generate(
      trackKey,
      thresholdGroup,
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
