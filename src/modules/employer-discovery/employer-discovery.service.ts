import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import { User } from '../users/entities/user.entity';
import { EmployerContactRequest } from './entities/employer-contact-request.entity';
import { EmployerSavedCandidate } from './entities/employer-saved-candidate.entity';
import { DiscoveryCandidatesQueryDto } from './dto/discovery-candidates-query.dto';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import { NotificationType } from '../notifications/notification-type.enum';
import { EmployerVerificationService } from '../employer/employer-verification.service';
import { Offer, OfferStatus } from '../offers/entities/offer.entity';

export type CandidateCard = {
  user_id: string;
  full_name: string;
  role_track: string | null;
  tier: string;
  availability: string | null;
  verified_at: Date;
  score: number;
  strong_competencies: string[] | null;
  share_token: string | null;
  is_saved: boolean;
  offer_sent: boolean;
  offer_status: OfferStatus.PENDING | OfferStatus.ACCEPTED | null;
};

export type DiscoveryListResult = {
  candidates: CandidateCard[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  empty_state_message: string | null;
};

type CandidateRawRow = {
  poolId: string;
  userId: string;
  roleTrack: string | null;
  tier: string;
  availability: string | null;
  verifiedAt: Date;
  score: number;
  strongCompetencies: string[] | null;
  shareToken: string | null;
  firstName: string | null;
  lastName: string | null;
  notes?: string | null;
};

type SavedCandidateIdRow = {
  s_candidate_user_id: string;
};

type CandidateOfferStatusRow = {
  offer_candidate_user_id: string;
  offer_status: OfferStatus.PENDING | OfferStatus.ACCEPTED;
};

@Injectable()
export class EmployerDiscoveryService {
  private readonly logger = new Logger(EmployerDiscoveryService.name);

  constructor(
    @InjectRepository(EmployerPoolProfile)
    private readonly poolProfileRepo: Repository<EmployerPoolProfile>,
    @InjectRepository(EmployerSavedCandidate)
    private readonly savedCandidateRepo: Repository<EmployerSavedCandidate>,
    @InjectRepository(EmployerContactRequest)
    private readonly contactRequestRepo: Repository<EmployerContactRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,
    private readonly notificationDispatch: NotificationDispatchService,
    private readonly verificationService: EmployerVerificationService,
  ) {}

  async discoverCandidates(
    employerUserId: string,
    query: DiscoveryCandidatesQueryDto,
  ): Promise<DiscoveryListResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const qb = this.poolProfileRepo
      .createQueryBuilder('pool')
      .innerJoin(User, 'u', 'u.id = pool.candidate_id')
      .where('pool.tier = :tier', { tier: 'job_ready' });

    if (query.roleTrack) {
      qb.andWhere('pool.track = :roleTrack', { roleTrack: query.roleTrack });
    }

    if (query.availability) {
      qb.andWhere('pool.availability = :availability', {
        availability: query.availability,
      });
    }

    if (query.search) {
      qb.andWhere(
        `(u.first_name ILIKE :search OR u.last_name ILIKE :search OR CONCAT(u.first_name, ' ', u.last_name) ILIKE :search)`,
        { search: `%${query.search}%` },
      );
    }

    qb.select([
      'pool.id AS "poolId"',
      'pool.candidate_id AS "userId"',
      'pool.track AS "roleTrack"',
      'pool.tier AS "tier"',
      'pool.availability AS "availability"',
      'pool.verified_at AS "verifiedAt"',
      'pool.score AS "score"',
      'pool.strong_competencies AS "strongCompetencies"',
      'pool.shareable_link_token AS "shareToken"',
      `u.first_name AS "firstName"`,
      `u.last_name AS "lastName"`,
    ]);

    const total = await qb.getCount();

    const rawResults: CandidateRawRow[] = await qb
      .orderBy('pool.score', 'DESC')
      .offset(offset)
      .limit(limit)
      .getRawMany();

    // Check which candidates are saved by this employer
    const candidateIds = rawResults.map((r) => r.userId);
    const savedMap = await this.getSavedMap(employerUserId, candidateIds);
    const offerStatusMap = await this.getOfferStatusMap(
      employerUserId,
      candidateIds,
    );

    const candidates: CandidateCard[] = rawResults.map((r) => ({
      user_id: r.userId,
      full_name: `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim(),
      role_track: r.roleTrack,
      tier: r.tier,
      availability: r.availability,
      verified_at: r.verifiedAt,
      score: r.score,
      strong_competencies: r.strongCompetencies,
      share_token: r.shareToken,
      is_saved: savedMap.has(r.userId),
      offer_sent: offerStatusMap.has(r.userId),
      offer_status: offerStatusMap.get(r.userId) ?? null,
    }));

    return {
      candidates,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
      empty_state_message:
        total === 0
          ? 'No saved candidates in this list. Try saving candidates or checking another list.'
          : null,
    };
  }

  async getCandidateProfile(
    employerUserId: string,
    candidateUserId: string,
  ): Promise<
    EmployerPoolProfile & {
      offer_sent: boolean;
      offer_status: OfferStatus.PENDING | OfferStatus.ACCEPTED | null;
    }
  > {
    const profile = await this.poolProfileRepo.findOne({
      where: { candidate_id: candidateUserId },
    });

    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }

    if (profile.tier !== 'job_ready') {
      throw new ForbiddenError(
        'Only Job Ready candidates are accessible to employers',
      );
    }

    const offerStatusMap = await this.getOfferStatusMap(employerUserId, [
      candidateUserId,
    ]);
    return Object.assign(profile, {
      offer_sent: offerStatusMap.has(candidateUserId),
      offer_status: offerStatusMap.get(candidateUserId) ?? null,
    });
  }

  async saveCandidate(
    employerUserId: string,
    candidateUserId: string,
    notes?: string,
  ): Promise<{ status: string; message: string }> {
    const poolProfile = await this.poolProfileRepo.findOne({
      where: { candidate_id: candidateUserId },
    });

    if (!poolProfile) {
      throw new NotFoundError('Candidate not found');
    }

    if (poolProfile.tier !== 'job_ready') {
      throw new ForbiddenError('Only Job Ready candidates can be saved');
    }

    try {
      await this.savedCandidateRepo.save({
        employer_user_id: employerUserId,
        candidate_user_id: candidateUserId,
        employer_pool_profile_id: poolProfile.id,
        notes: notes ?? null,
      });
    } catch (error: unknown) {
      // Unique constraint violation (concurrent duplicate save)
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        throw new ConflictError('Candidate already saved');
      }
      throw error;
    }

    return { status: 'success', message: 'Candidate saved to shortlist' };
  }

  async unsaveCandidate(
    employerUserId: string,
    candidateUserId: string,
  ): Promise<{ status: string; message: string }> {
    const result = await this.savedCandidateRepo.delete({
      employer_user_id: employerUserId,
      candidate_user_id: candidateUserId,
    });

    if (!result.affected) {
      throw new NotFoundError('Saved candidate not found');
    }

    return { status: 'success', message: 'Candidate removed from shortlist' };
  }

  async listSavedCandidates(
    employerUserId: string,
    page = 1,
    limit = 20,
  ): Promise<DiscoveryListResult> {
    const offset = (page - 1) * limit;

    const qb = this.savedCandidateRepo
      .createQueryBuilder('saved')
      .innerJoin(
        EmployerPoolProfile,
        'pool',
        'pool.candidate_id = saved.candidate_user_id',
      )
      .innerJoin(User, 'u', 'u.id = saved.candidate_user_id')
      .where('saved.employer_user_id = :employerUserId', { employerUserId })
      .andWhere('pool.tier = :tier', { tier: 'job_ready' });

    qb.select([
      'pool.candidate_id AS "userId"',
      'pool.track AS "roleTrack"',
      'pool.tier AS "tier"',
      'pool.availability AS "availability"',
      'pool.verified_at AS "verifiedAt"',
      'pool.score AS "score"',
      'pool.strong_competencies AS "strongCompetencies"',
      'pool.shareable_link_token AS "shareToken"',
      `u.first_name AS "firstName"`,
      `u.last_name AS "lastName"`,
      'saved.notes AS "notes"',
    ]);

    const total = await qb.getCount();

    const rawResults: CandidateRawRow[] = await qb
      .orderBy('saved.created_at', 'DESC')
      .offset(offset)
      .limit(limit)
      .getRawMany();

    const candidateIds = rawResults.map((r) => r.userId);
    const offerStatusMap = await this.getOfferStatusMap(
      employerUserId,
      candidateIds,
    );

    const candidates: CandidateCard[] = rawResults.map((r) => ({
      user_id: r.userId,
      full_name: `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim(),
      role_track: r.roleTrack,
      tier: r.tier,
      availability: r.availability,
      verified_at: r.verifiedAt,
      score: r.score,
      strong_competencies: r.strongCompetencies,
      share_token: r.shareToken,
      is_saved: true,
      offer_sent: offerStatusMap.has(r.userId),
      offer_status: offerStatusMap.get(r.userId) ?? null,
    }));

    return {
      candidates,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
      empty_state_message:
        total === 0
          ? 'No candidates match your current filters. Try adjusting your selection.'
          : null,
    };
  }

  async contactCandidate(
    employerUserId: string,
    candidateUserId: string,
    message: string,
  ): Promise<{ status: string; message: string }> {
    await this.verificationService.assertEmployerVerified(employerUserId);

    const poolProfile = await this.poolProfileRepo.findOne({
      where: { candidate_id: candidateUserId },
    });

    if (!poolProfile) {
      throw new NotFoundError('Candidate not found');
    }

    if (poolProfile.tier !== 'job_ready') {
      throw new ForbiddenError('Only Job Ready candidates can be contacted');
    }

    const contactRequest = await this.contactRequestRepo.save({
      employer_user_id: employerUserId,
      candidate_user_id: candidateUserId,
      message,
    });

    // Dispatch notification to candidate
    const employer = await this.userRepo.findOne({
      where: { id: employerUserId },
    });
    const employerName = employer
      ? `${employer.first_name ?? ''} ${employer.last_name ?? ''}`.trim()
      : 'An employer';

    try {
      await this.notificationDispatch.dispatch(
        NotificationType.CONTACT_REQUEST_RECEIVED,
        candidateUserId,
        {
          contactRequestId: contactRequest.id,
          employerUserId,
          employerName,
        },
      );
    } catch (error) {
      this.logger.error(
        `Contact request notification failed request=${contactRequest.id}: ${String(error)}`,
      );
    }

    return { status: 'success', message: 'Contact request sent' };
  }

  private async getSavedMap(
    employerUserId: string,
    candidateIds: string[],
  ): Promise<Set<string>> {
    if (candidateIds.length === 0) return new Set();

    const saved: SavedCandidateIdRow[] = await this.savedCandidateRepo
      .createQueryBuilder('s')
      .select('s.candidate_user_id')
      .where('s.employer_user_id = :employerUserId', { employerUserId })
      .andWhere('s.candidate_user_id IN (:...candidateIds)', { candidateIds })
      .getRawMany();

    return new Set(saved.map((row) => row.s_candidate_user_id));
  }

  private async getOfferStatusMap(
    employerUserId: string,
    candidateIds: string[],
  ): Promise<Map<string, OfferStatus.PENDING | OfferStatus.ACCEPTED>> {
    if (candidateIds.length === 0) return new Map();

    const rows: CandidateOfferStatusRow[] = await this.offerRepo
      .createQueryBuilder('offer')
      .select(['offer.candidate_user_id', 'offer.status'])
      .where('offer.employer_user_id = :employerUserId', { employerUserId })
      .andWhere('offer.candidate_user_id IN (:...candidateIds)', {
        candidateIds,
      })
      .andWhere('offer.status IN (:...statuses)', {
        statuses: [OfferStatus.PENDING, OfferStatus.ACCEPTED],
      })
      .getRawMany();

    return new Map(
      rows.map((row) => [row.offer_candidate_user_id, row.offer_status]),
    );
  }
}
