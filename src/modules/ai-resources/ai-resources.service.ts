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

@Injectable()
export class AiResourcesService {
  private readonly logger = new Logger(AiResourcesService.name);

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
    } else if (percentage < 75) {
      thresholdGroup = ScoreThresholdGroup.BETWEEN_50_75;
    } else {
      thresholdGroup = ScoreThresholdGroup.ABOVE_75;
    }

    const trackKey = profile.track.toLowerCase().trim();

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
      return cached;
    }

    // 6. Cache miss -> Invoke AI resource generation
    this.logger.log(
      `Cache miss for resources: track=${trackKey} threshold=${thresholdGroup}. Generating via AI...`,
    );
    const generated = await this.resourceGenerationService.generate(
      trackKey,
      thresholdGroup,
    );

    // 7. Save to the database
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
      // If another request concurrently saved it, read and return the saved one
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
}
