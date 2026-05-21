import { Injectable, Logger } from '@nestjs/common';
import { AssessmentTier } from '../assessments/entities/assessment-result.entity';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { NotificationType } from './entities/user-notification.entity';
import { NotificationsService } from './notifications.service';

export type AdvancedScoreReadyPayload = {
  score: number;
  maxScore: number;
  percentage: number;
  tier: AssessmentTier;
};

@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
  ) {}

  async dispatch(
    type: NotificationType,
    userId: string,
    payload: AdvancedScoreReadyPayload,
  ): Promise<void> {
    try {
      switch (type) {
        case NotificationType.ADVANCED_ASSESSMENT_SCORE_READY:
          await this.dispatchAdvancedScoreReady(userId, payload);
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
