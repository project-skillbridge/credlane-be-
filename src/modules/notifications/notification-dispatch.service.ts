import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { AssessmentTier } from '../assessments/entities/assessment-result.entity';
import { MailService } from '../mail/mail.service';
import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { UsersService } from '../users/users.service';
import { NotificationType } from './notification-type.enum';
import { NotificationsService } from './notifications.service';

export type AdvancedScoreReadyPayload = {
  score: number;
  maxScore: number;
  percentage: number;
  tier: AssessmentTier;
};

export type AdvancedRetakeAvailablePayload = {
  eligibilityDate: string;
};

type RetakeEligibilityProfile = Pick<
  TalentProfile,
  'advanced_retake_required' | 'assessment_locked_until'
>;

const RETAKE_NOTIFY_POLL_MS = 60 * 60 * 1000;

@Injectable()
export class NotificationDispatchService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationDispatchService.name);
  private retakePollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepo: Repository<TalentProfile>,
  ) {}

  onModuleInit(): void {
    void this.processDueRetakeNotifications();
    this.retakePollTimer = setInterval(
      () => void this.processDueRetakeNotifications(),
      RETAKE_NOTIFY_POLL_MS,
    );
  }

  onModuleDestroy(): void {
    if (this.retakePollTimer) {
      clearInterval(this.retakePollTimer);
      this.retakePollTimer = null;
    }
  }

  async dispatch(
    type: NotificationType.ADVANCED_ASSESSMENT_SCORE_READY,
    userId: string,
    payload: AdvancedScoreReadyPayload,
  ): Promise<void>;
  async dispatch(
    type: NotificationType.ADVANCED_RETAKE_AVAILABLE,
    userId: string,
    payload: AdvancedRetakeAvailablePayload,
  ): Promise<void>;
  async dispatch(
    type: NotificationType,
    userId: string,
    payload: AdvancedScoreReadyPayload | AdvancedRetakeAvailablePayload,
  ): Promise<void> {
    try {
      switch (type) {
        case NotificationType.ADVANCED_ASSESSMENT_SCORE_READY:
          await this.dispatchAdvancedScoreReady(
            userId,
            payload as AdvancedScoreReadyPayload,
          );
          break;
        case NotificationType.ADVANCED_RETAKE_AVAILABLE:
          await this.dispatchAdvancedRetakeAvailable(
            userId,
            payload as AdvancedRetakeAvailablePayload,
          );
          break;
        default:
          this.logger.warn(
            `Unhandled notification type: ${String(type)}`,
          );
      }
    } catch (error) {
      this.logger.error(
        `Notification dispatch failed type=${type} user=${userId}: ${String(error)}`,
      );
    }
  }

  /** In-app + email when the 14-day advanced retake gate has passed (once per window). */
  async notifyAdvancedRetakeIfEligible(
    userId: string,
    profile: RetakeEligibilityProfile | null,
  ): Promise<void> {
    const eligibilityDate = this.resolveRetakeEligibilityDate(profile);
    if (!eligibilityDate) {
      return;
    }

    await this.dispatch(NotificationType.ADVANCED_RETAKE_AVAILABLE, userId, {
      eligibilityDate,
    });
  }

  async processDueRetakeNotifications(): Promise<void> {
    const profiles = await this.talentProfileRepo.find({
      where: {
        advanced_retake_required: true,
        assessment_locked_until: LessThanOrEqual(new Date()),
      },
      select: {
        user_id: true,
        advanced_retake_required: true,
        assessment_locked_until: true,
      },
    });

    for (const profile of profiles) {
      try {
        await this.notifyAdvancedRetakeIfEligible(profile.user_id, profile);
      } catch (error) {
        this.logger.error(
          `Retake notification failed user=${profile.user_id}: ${String(error)}`,
        );
      }
    }
  }

  private resolveRetakeEligibilityDate(
    profile: RetakeEligibilityProfile | null,
  ): string | null {
    if (
      !profile?.advanced_retake_required ||
      !profile.assessment_locked_until
    ) {
      return null;
    }

    if (profile.assessment_locked_until.getTime() > Date.now()) {
      return null;
    }

    return profile.assessment_locked_until.toISOString();
  }

  private async dispatchAdvancedScoreReady(
    userId: string,
    result: AdvancedScoreReadyPayload,
  ): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      this.logger.warn(
        `Notification skipped: user not found user=${userId}`,
      );
      return;
    }

    const tierLabel = this.formatTierLabel(result.tier);

    await this.notificationsService.create({
      userId,
      type: NotificationType.ADVANCED_ASSESSMENT_SCORE_READY,
      title: 'Your assessment results are ready',
      body: `You scored ${result.score}/${result.maxScore} (${result.percentage}%) — ${tierLabel}.`,
      data: {
        score: result.score,
        maxScore: result.maxScore,
        percentage: result.percentage,
        tier: result.tier,
        tierLabel,
      },
    });

    try {
      await this.mailService.sendAssessmentPerformance({
        to: user.email,
        recipientFirstName: user.first_name,
        score: result.score,
        maxScore: result.maxScore,
        percentage: result.percentage,
        tierLabel,
      });
    } catch (error) {
      this.logger.error(
        `Assessment performance email failed for user=${userId}: ${String(error)}`,
      );
    }
  }

  private async dispatchAdvancedRetakeAvailable(
    userId: string,
    payload: AdvancedRetakeAvailablePayload,
  ): Promise<void> {
    const alreadySent = await this.notificationsService.hasDedupedNotification(
      userId,
      NotificationType.ADVANCED_RETAKE_AVAILABLE,
      payload.eligibilityDate,
    );
    if (alreadySent) {
      return;
    }

    const user = await this.usersService.findOne(userId);
    if (!user) {
      this.logger.warn(
        `Notification skipped: user not found user=${userId}`,
      );
      return;
    }

    await this.notificationsService.create({
      userId,
      type: NotificationType.ADVANCED_RETAKE_AVAILABLE,
      title: 'Advanced assessment retake is available',
      body: 'Your 14-day waiting period has ended. You can retake the advanced assessment now.',
      data: { eligibilityDate: payload.eligibilityDate },
    });

    try {
      await this.mailService.sendAdvancedRetakeAvailable({
        to: user.email,
        recipientFirstName: user.first_name,
      });
    } catch (error) {
      this.logger.error(
        `Advanced retake email failed for user=${userId}: ${String(error)}`,
      );
    }
  }

  private formatTierLabel(tier: AssessmentTier): string {
    switch (tier) {
      case AssessmentTier.JOB_READY:
        return 'Job Ready';
      case AssessmentTier.EMERGING:
        return 'Emerging';
      default:
        return 'Not Ready';
    }
  }
}
