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
import {
  isNotificationDuplicateError,
  NotificationsService,
} from './notifications.service';

export type AdvancedScoreReadyPayload = {
  score: number;
  maxScore: number;
  percentage: number;
  tier: AssessmentTier;
};

export type AdvancedRetakeAvailablePayload = {
  eligibilityDate: string;
};

export type OfferReceivedPayload = {
  offerId: string;
  employerUserId: string;
  employerName: string;
  roleTitle: string;
};

export type OfferRespondedPayload = {
  offerId: string;
  candidateUserId: string;
  candidateName: string;
  roleTitle: string;
  action: 'accept' | 'decline';
};

export type ContactRequestReceivedPayload = {
  contactRequestId: string;
  employerUserId: string;
  employerName: string;
};

export type AssessmentReceivedPayload = {
  assessmentId: string;
  title: string;
  roleTrack: string;
  shareUrl: string;
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
    type: NotificationType.OFFER_RECEIVED,
    userId: string,
    payload: OfferReceivedPayload,
  ): Promise<void>;
  async dispatch(
    type: NotificationType.OFFER_ACCEPTED | NotificationType.OFFER_DECLINED,
    userId: string,
    payload: OfferRespondedPayload,
  ): Promise<void>;
  async dispatch(
    type: NotificationType.CONTACT_REQUEST_RECEIVED,
    userId: string,
    payload: ContactRequestReceivedPayload,
  ): Promise<void>;
  async dispatch(
    type: NotificationType.ASSESSMENT_RECEIVED,
    userId: string,
    payload: AssessmentReceivedPayload,
  ): Promise<void>;
  async dispatch(
    type: NotificationType,
    userId: string,
    payload:
      | AdvancedScoreReadyPayload
      | AdvancedRetakeAvailablePayload
      | OfferReceivedPayload
      | OfferRespondedPayload
      | ContactRequestReceivedPayload
      | AssessmentReceivedPayload,
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
        case NotificationType.OFFER_RECEIVED:
          await this.dispatchOfferReceived(
            userId,
            payload as OfferReceivedPayload,
          );
          break;
        case NotificationType.OFFER_ACCEPTED:
        case NotificationType.OFFER_DECLINED:
          await this.dispatchOfferResponded(
            type,
            userId,
            payload as OfferRespondedPayload,
          );
          break;
        case NotificationType.CONTACT_REQUEST_RECEIVED:
          await this.dispatchContactRequestReceived(
            userId,
            payload as ContactRequestReceivedPayload,
          );
          break;
        case NotificationType.ASSESSMENT_RECEIVED:
          await this.dispatchAssessmentReceived(
            userId,
            payload as AssessmentReceivedPayload,
          );
          break;
        default:
          this.logger.warn(`Unhandled notification type: ${String(type)}`);
      }
    } catch (error) {
      this.logger.error(
        `Notification dispatch failed type=${type} user=${userId}: ${String(error)}`,
      );
    }
  }

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
      this.logger.warn(`Notification skipped: user not found user=${userId}`);
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
    const user = await this.usersService.findOne(userId);
    if (!user) {
      this.logger.warn(`Notification skipped: user not found user=${userId}`);
      return;
    }

    try {
      await this.notificationsService.create({
        userId,
        type: NotificationType.ADVANCED_RETAKE_AVAILABLE,
        title: 'Advanced assessment retake is available',
        body: 'Your 14-day waiting period has ended. You can retake the advanced assessment now.',
        data: { eligibilityDate: payload.eligibilityDate },
      });
    } catch (error) {
      if (isNotificationDuplicateError(error)) {
        return;
      }
      throw error;
    }

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

  private async dispatchOfferReceived(
    userId: string,
    payload: OfferReceivedPayload,
  ): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      this.logger.warn(`Notification skipped: user not found user=${userId}`);
      return;
    }

    await this.notificationsService.create({
      userId,
      type: NotificationType.OFFER_RECEIVED,
      title: 'New offer received',
      body: `${payload.employerName} sent you an offer for ${payload.roleTitle}.`,
      data: {
        offerId: payload.offerId,
        employerUserId: payload.employerUserId,
        employerName: payload.employerName,
        roleTitle: payload.roleTitle,
      },
    });

    try {
      await this.mailService.send({
        to: user.email,
        subject: `New offer: ${payload.roleTitle}`,
        text: `Hi ${user.first_name},\n\n${payload.employerName} has sent you an offer for the role of ${payload.roleTitle}. Log in to view and respond.\n\nBest,\nSkillBridge Team`,
      });
    } catch (error) {
      this.logger.error(
        `Offer received email failed for user=${userId}: ${String(error)}`,
      );
    }
  }

  private async dispatchOfferResponded(
    type: NotificationType.OFFER_ACCEPTED | NotificationType.OFFER_DECLINED,
    userId: string,
    payload: OfferRespondedPayload,
  ): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      this.logger.warn(`Notification skipped: user not found user=${userId}`);
      return;
    }

    // Derive action from type to guarantee consistency
    const resolvedAction =
      type === NotificationType.OFFER_ACCEPTED ? 'accept' : 'decline';
    const actionLabel = resolvedAction === 'accept' ? 'accepted' : 'declined';
    const title =
      resolvedAction === 'accept' ? 'Offer accepted!' : 'Offer declined';

    await this.notificationsService.create({
      userId,
      type,
      title,
      body: `${payload.candidateName} has ${actionLabel} your offer for ${payload.roleTitle}.`,
      data: {
        offerId: payload.offerId,
        candidateUserId: payload.candidateUserId,
        candidateName: payload.candidateName,
        roleTitle: payload.roleTitle,
        action: resolvedAction,
      },
    });

    try {
      await this.mailService.send({
        to: user.email,
        subject: `Offer ${actionLabel}: ${payload.roleTitle}`,
        text: `Hi ${user.first_name},\n\n${payload.candidateName} has ${actionLabel} your offer for ${payload.roleTitle}. Log in to view details.\n\nBest,\nSkillBridge Team`,
      });
    } catch (error) {
      this.logger.error(
        `Offer response email failed for user=${userId}: ${String(error)}`,
      );
    }
  }

  private async dispatchContactRequestReceived(
    userId: string,
    payload: ContactRequestReceivedPayload,
  ): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      this.logger.warn(`Notification skipped: user not found user=${userId}`);
      return;
    }

    await this.notificationsService.create({
      userId,
      type: NotificationType.CONTACT_REQUEST_RECEIVED,
      title: 'New contact request',
      body: `${payload.employerName} wants to connect with you.`,
      data: {
        contactRequestId: payload.contactRequestId,
        employerUserId: payload.employerUserId,
        employerName: payload.employerName,
      },
    });

    try {
      await this.mailService.send({
        to: user.email,
        subject: 'An employer wants to connect with you',
        text: `Hi ${user.first_name},\n\n${payload.employerName} is interested in your profile and wants to connect. Log in to view the message.\n\nBest,\nSkillBridge Team`,
      });
    } catch (error) {
      this.logger.error(
        `Contact request email failed for user=${userId}: ${String(error)}`,
      );
    }
  }

  private async dispatchAssessmentReceived(
    userId: string,
    payload: AssessmentReceivedPayload,
  ): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      this.logger.warn(`Notification skipped: user not found user=${userId}`);
      return;
    }

    await this.notificationsService.create({
      userId,
      type: NotificationType.ASSESSMENT_RECEIVED,
      title: 'New assessment received',
      body: `You have been invited to take ${payload.title}.`,
      data: {
        assessmentId: payload.assessmentId,
        title: payload.title,
        roleTrack: payload.roleTrack,
        shareUrl: payload.shareUrl,
      },
    });

    try {
      await this.mailService.send({
        to: user.email,
        subject: `Assessment invite: ${payload.title}`,
        text: `Hi ${user.first_name},\n\nYou have been invited to take ${payload.title}. Log in to CredLane to begin.\n\nBest,\nSkillBridge Team`,
      });
    } catch (error) {
      this.logger.error(
        `Assessment invite email failed for user=${userId}: ${String(error)}`,
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
