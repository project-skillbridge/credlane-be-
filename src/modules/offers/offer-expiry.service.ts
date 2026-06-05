import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Repository } from 'typeorm';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import { User } from '../users/entities/user.entity';
import { Offer, OfferStatus } from './entities/offer.entity';

const EXPIRY_POLL_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class OfferExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OfferExpiryService.name);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  /** Prevents overlapping executions when a poll cycle outlasts the interval. */
  private isRunning = false;

  constructor(
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationDispatch: NotificationDispatchService,
  ) {}

  onModuleInit(): void {
    void this.processExpiryEvents();
    this.pollTimer = setInterval(
      () => void this.processExpiryEvents(),
      EXPIRY_POLL_MS,
    );
  }

  onModuleDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async processExpiryEvents(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Skipping expiry poll — previous run still in progress');
      return;
    }
    this.isRunning = true;
    try {
      await this.expireAssessmentWindows();
      await this.sendExpiryWarnings();
    } finally {
      this.isRunning = false;
    }
  }

  private async expireAssessmentWindows(): Promise<void> {
    const now = new Date();

    // Bulk-transition all overdue offers in one statement and retrieve the
    // affected rows so we can notify without a second round-trip.
    const overdueOffers = await this.offerRepo
      .createQueryBuilder()
      .update(Offer)
      .set({ status: OfferStatus.EXPIRED })
      .where('status = :status AND assessment_deadline < :now', {
        status: OfferStatus.ASSESSMENT_UNLOCKED,
        now,
      })
      .returning(['id', 'employer_user_id', 'candidate_user_id', 'role_title'])
      .execute();

    const rows = (overdueOffers.raw ?? []) as Array<{
      id: string;
      employer_user_id: string;
      candidate_user_id: string;
      role_title: string;
    }>;

    if (rows.length === 0) return;

    // Batch-load all candidate names in a single query
    const candidateIds = [...new Set(rows.map((r) => r.candidate_user_id))];
    const candidates = await this.userRepo.find({
      where: { id: In(candidateIds) },
      select: ['id', 'first_name', 'last_name'],
    });
    const nameById = new Map(
      candidates.map((c) => [
        c.id,
        `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'A candidate',
      ]),
    );

    for (const row of rows) {
      try {
        await this.notificationDispatch.notifyOfferExpired(
          row.employer_user_id,
          {
            offerId: row.id,
            candidateUserId: row.candidate_user_id,
            candidateName: nameById.get(row.candidate_user_id) ?? 'A candidate',
            roleTitle: row.role_title,
          },
        );
      } catch (error: unknown) {
        this.logger.error(
          `Expiry notification failed offer=${row.id}: ${String(error)}`,
        );
      }
    }
  }

  private async sendExpiryWarnings(): Promise<void> {
    const now = new Date();
    const warningCutoff = new Date(now.getTime() + WARNING_WINDOW_MS);

    // Find ASSESSMENT_UNLOCKED offers expiring within the next 24 hours
    // that have not yet had a warning sent
    const expiringOffers = await this.offerRepo.find({
      where: {
        status: OfferStatus.ASSESSMENT_UNLOCKED,
        assessment_deadline: Between(now, warningCutoff),
        expiry_warning_sent_at: IsNull(),
      },
      select: [
        'id',
        'employer_user_id',
        'candidate_user_id',
        'role_title',
        'assessment_deadline',
      ],
    });

    if (expiringOffers.length === 0) return;

    // Batch-load all candidate names in a single query
    const candidateIds = [
      ...new Set(expiringOffers.map((o) => o.candidate_user_id)),
    ];
    const candidates = await this.userRepo.find({
      where: { id: In(candidateIds) },
      select: ['id', 'first_name', 'last_name'],
    });
    const nameById = new Map(
      candidates.map((c) => [
        c.id,
        `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'A candidate',
      ]),
    );

    for (const offer of expiringOffers) {
      // Mark atomically before dispatching to prevent duplicate warnings on
      // concurrent poll cycles or simultaneous instances. Include the deadline
      // window so stale reads from a slow previous cycle cannot mark rows
      // that have since been extended outside the warning window.
      const marked = await this.offerRepo.update(
        {
          id: offer.id,
          status: OfferStatus.ASSESSMENT_UNLOCKED,
          assessment_deadline: Between(now, warningCutoff),
          expiry_warning_sent_at: IsNull(),
        },
        { expiry_warning_sent_at: now },
      );

      if (!marked.affected || marked.affected === 0) {
        continue;
      }

      try {
        await this.notificationDispatch.notifyAssessmentWindowExpiring(
          offer.employer_user_id,
          {
            offerId: offer.id,
            candidateUserId: offer.candidate_user_id,
            candidateName:
              nameById.get(offer.candidate_user_id) ?? 'A candidate',
            roleTitle: offer.role_title,
            assessmentDeadline: offer.assessment_deadline!.toISOString(),
          },
        );
      } catch (error: unknown) {
        this.logger.error(
          `Expiry warning notification failed offer=${offer.id}: ${String(error)}`,
        );
      }
    }
  }
}
