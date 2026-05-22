import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThan, Repository } from 'typeorm';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
} from '../../shared';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import { User } from '../users/entities/user.entity';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import { NotificationType } from '../notifications/notification-type.enum';
import { Offer, OfferStatus } from './entities/offer.entity';
import { OfferDistributionLog } from './entities/offer-distribution-log.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { ListOffersQueryDto } from './dto/list-offers-query.dto';

const DEFAULT_MONTHLY_CAP = 50;

export type OfferListResult = {
  offers: Offer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type OfferAnalytics = {
  offersThisMonth: number;
  monthlyCap: number;
  remaining: number;
  acceptedCount: number;
  declinedCount: number;
  pendingCount: number;
  expiredCount: number;
};

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);
  private readonly monthlyCap: number;

  constructor(
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,
    @InjectRepository(OfferDistributionLog)
    private readonly distributionLogRepo: Repository<OfferDistributionLog>,
    @InjectRepository(EmployerPoolProfile)
    private readonly poolProfileRepo: Repository<EmployerPoolProfile>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationDispatch: NotificationDispatchService,
  ) {
    this.monthlyCap =
      parseInt(process.env.OFFERS_MONTHLY_CAP ?? '', 10) || DEFAULT_MONTHLY_CAP;
  }

  async createOffer(
    employerUserId: string,
    dto: CreateOfferDto,
  ): Promise<Offer> {
    // Validate candidate is Job Ready
    const poolProfile = await this.poolProfileRepo.findOne({
      where: { candidate_id: dto.candidateUserId },
    });

    if (!poolProfile) {
      throw new NotFoundError('Candidate not found');
    }

    if (poolProfile.tier !== 'job_ready') {
      throw new ForbiddenError(
        'Offers can only be sent to Job Ready candidates',
      );
    }

    // Enforce send-cap atomically via transaction
    const expiresInDays = dto.expiresInDays ?? 14;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const offer = await this.offerRepo.manager.transaction(async (manager) => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      const monthlyCount = await manager.count(OfferDistributionLog, {
        where: {
          employer_user_id: employerUserId,
          sent_at: Between(startOfMonth, endOfMonth),
        },
      });

      if (monthlyCount >= this.monthlyCap) {
        throw new TooManyRequestsError(
          `Monthly offer limit reached (${this.monthlyCap}). Try again next month.`,
        );
      }

      const created = await manager.save(Offer, {
        employer_user_id: employerUserId,
        candidate_user_id: dto.candidateUserId,
        employer_pool_profile_id: poolProfile.id,
        role_title: dto.roleTitle,
        message: dto.message,
        status: OfferStatus.PENDING,
        expires_at: expiresAt,
      } as Partial<Offer>);

      await manager.save(OfferDistributionLog, {
        employer_user_id: employerUserId,
        offer_id: created.id,
      } as Partial<OfferDistributionLog>);

      return created;
    });

    // Notify candidate
    const employer = await this.userRepo.findOne({
      where: { id: employerUserId },
    });
    const employerName = employer
      ? `${employer.first_name ?? ''} ${employer.last_name ?? ''}`.trim()
      : 'An employer';

    try {
      await this.notificationDispatch.dispatch(
        NotificationType.OFFER_RECEIVED,
        dto.candidateUserId,
        {
          offerId: offer.id,
          employerUserId,
          employerName,
          roleTitle: dto.roleTitle,
        },
      );
    } catch (error) {
      this.logger.error(
        `Offer notification failed offer=${offer.id}: ${String(error)}`,
      );
    }

    return offer;
  }

  async listEmployerOffers(
    employerUserId: string,
    query: ListOffersQueryDto,
  ): Promise<OfferListResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Expire stale offers before querying to keep filter/pagination consistent
    await this.expireStaleOffers(employerUserId);

    const where: Record<string, unknown> = {
      employer_user_id: employerUserId,
    };

    if (query.status) {
      where.status = query.status;
    }

    const [offers, total] = await this.offerRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['candidate'],
    });

    return {
      offers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listCandidateOffers(
    candidateUserId: string,
    query: ListOffersQueryDto,
  ): Promise<OfferListResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Expire stale offers before querying
    await this.expireStaleOffersForCandidate(candidateUserId);

    const where: Record<string, unknown> = {
      candidate_user_id: candidateUserId,
    };

    if (query.status) {
      where.status = query.status;
    }

    const [offers, total] = await this.offerRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['employer'],
    });

    return {
      offers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOfferForEmployer(
    employerUserId: string,
    offerId: string,
  ): Promise<Offer> {
    const offer = await this.offerRepo.findOne({
      where: { id: offerId, employer_user_id: employerUserId },
      relations: ['candidate'],
    });

    if (!offer) {
      throw new NotFoundError('Offer not found');
    }

    return this.checkAndUpdateExpiry(offer);
  }

  async getOfferForCandidate(
    candidateUserId: string,
    offerId: string,
  ): Promise<Offer> {
    const offer = await this.offerRepo.findOne({
      where: { id: offerId, candidate_user_id: candidateUserId },
      relations: ['employer'],
    });

    if (!offer) {
      throw new NotFoundError('Offer not found');
    }

    return this.checkAndUpdateExpiry(offer);
  }

  async respondToOffer(
    candidateUserId: string,
    offerId: string,
    action: 'accept' | 'decline',
  ): Promise<Offer> {
    const offer = await this.offerRepo.findOne({
      where: { id: offerId, candidate_user_id: candidateUserId },
    });

    if (!offer) {
      throw new NotFoundError('Offer not found');
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestError(
        `Cannot respond to an offer with status: ${offer.status}`,
      );
    }

    const newStatus =
      action === 'accept' ? OfferStatus.ACCEPTED : OfferStatus.DECLINED;
    const respondedAt = new Date();

    // Atomic conditional update to prevent race conditions
    const result = await this.offerRepo.update(
      {
        id: offer.id,
        status: OfferStatus.PENDING,
        expires_at: LessThan(new Date()) as unknown as Date,
      },
      { status: OfferStatus.EXPIRED },
    );

    // If the offer was just expired by the above, throw
    if (result.affected && result.affected > 0) {
      throw new BadRequestError('This offer has expired');
    }

    // Now atomically set the response (only if still PENDING)
    const updateResult = await this.offerRepo.update(
      { id: offer.id, status: OfferStatus.PENDING },
      { status: newStatus, responded_at: respondedAt },
    );

    if (!updateResult.affected || updateResult.affected === 0) {
      throw new BadRequestError(
        `Cannot respond to an offer with status: ${offer.status}`,
      );
    }

    offer.status = newStatus;
    offer.responded_at = respondedAt;

    // Notify employer
    const notificationType =
      action === 'accept'
        ? NotificationType.OFFER_ACCEPTED
        : NotificationType.OFFER_DECLINED;

    const candidate = await this.userRepo.findOne({
      where: { id: candidateUserId },
    });
    const candidateName = candidate
      ? `${candidate.first_name ?? ''} ${candidate.last_name ?? ''}`.trim()
      : 'A candidate';

    try {
      await this.notificationDispatch.dispatch(
        notificationType,
        offer.employer_user_id,
        {
          offerId: offer.id,
          candidateUserId,
          candidateName,
          roleTitle: offer.role_title,
          action,
        },
      );
    } catch (error) {
      this.logger.error(
        `Offer response notification failed offer=${offer.id}: ${String(error)}`,
      );
    }

    return offer;
  }

  async getAnalytics(employerUserId: string): Promise<OfferAnalytics> {
    // Expire stale offers so counts reflect true statuses
    await this.expireStaleOffers(employerUserId);

    const monthlyCount = await this.getDistributionCount(employerUserId);

    const [acceptedCount, declinedCount, pendingCount, expiredCount] =
      await Promise.all([
        this.offerRepo.count({
          where: {
            employer_user_id: employerUserId,
            status: OfferStatus.ACCEPTED,
          },
        }),
        this.offerRepo.count({
          where: {
            employer_user_id: employerUserId,
            status: OfferStatus.DECLINED,
          },
        }),
        this.offerRepo.count({
          where: {
            employer_user_id: employerUserId,
            status: OfferStatus.PENDING,
          },
        }),
        this.offerRepo.count({
          where: {
            employer_user_id: employerUserId,
            status: OfferStatus.EXPIRED,
          },
        }),
      ]);

    return {
      offersThisMonth: monthlyCount,
      monthlyCap: this.monthlyCap,
      remaining: Math.max(0, this.monthlyCap - monthlyCount),
      acceptedCount,
      declinedCount,
      pendingCount,
      expiredCount,
    };
  }

  private async getDistributionCount(employerUserId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    return this.distributionLogRepo.count({
      where: {
        employer_user_id: employerUserId,
        sent_at: Between(startOfMonth, endOfMonth),
      },
    });
  }

  private async checkAndUpdateExpiry(offer: Offer): Promise<Offer> {
    if (offer.status === OfferStatus.PENDING && offer.expires_at < new Date()) {
      offer.status = OfferStatus.EXPIRED;
      await this.offerRepo.update(offer.id, {
        status: OfferStatus.EXPIRED,
      });
    }
    return offer;
  }

  private async expireStaleOffers(employerUserId: string): Promise<void> {
    await this.offerRepo.update(
      {
        employer_user_id: employerUserId,
        status: OfferStatus.PENDING,
        expires_at: LessThan(new Date()),
      },
      { status: OfferStatus.EXPIRED },
    );
  }

  private async expireStaleOffersForCandidate(
    candidateUserId: string,
  ): Promise<void> {
    await this.offerRepo.update(
      {
        candidate_user_id: candidateUserId,
        status: OfferStatus.PENDING,
        expires_at: LessThan(new Date()),
      },
      { status: OfferStatus.EXPIRED },
    );
  }
}
