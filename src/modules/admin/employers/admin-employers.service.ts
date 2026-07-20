import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployerProfile } from '../../employer/entities/employer-profile.entity';
import { EmployerVerificationService } from '../../employer/employer-verification.service';
import {
  EmployerRole,
  EmployerRoleStatus,
} from '../../employer-roles/entities/employer-role.entity';
import { Offer, OfferStatus } from '../../offers/entities/offer.entity';
import { ListEmployersQueryDto } from './dto/list-employers-query.dto';

/** Package tiers don't exist yet (spec OQ-04 — names/prices/features pending).
 * Every employer is on Free until the Payments page lands real tiers. */
const PACKAGE_TIER_PLACEHOLDER = 'Free';

export interface EmployerListRow {
  id: string;
  company_name: string | null;
  is_verified: boolean;
  package_tier: string;
  hire_count: number;
  offers_sent_count: number;
  roles_created_count: number;
  account_age_days: number;
  last_activity_date: Date;
}

@Injectable()
export class AdminEmployersService {
  constructor(
    @InjectRepository(EmployerProfile)
    private readonly employerProfileRepo: Repository<EmployerProfile>,
    @InjectRepository(EmployerRole)
    private readonly employerRoleRepo: Repository<EmployerRole>,
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,
    private readonly verificationService: EmployerVerificationService,
  ) {}

  async findAll(query: ListEmployersQueryDto): Promise<{
    items: EmployerListRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.employerProfileRepo.createQueryBuilder('ep');

    const rolesCountSubQuery = qb
      .subQuery()
      .select('COUNT(*)')
      .from(EmployerRole, 'role')
      .where('role.employer_user_id = ep.user_id')
      .getQuery();

    const offersCountSubQuery = qb
      .subQuery()
      .select('COUNT(*)')
      .from(Offer, 'offer')
      .where('offer.employer_user_id = ep.user_id')
      .getQuery();

    qb.addSelect(`(${rolesCountSubQuery})`, 'roles_created_count').addSelect(
      `(${offersCountSubQuery})`,
      'offers_sent_count',
    );

    if (query.is_verified !== undefined) {
      qb.andWhere('ep.is_verified = :isVerified', {
        isVerified: query.is_verified === 'true',
      });
    }
    if (query.region) {
      qb.andWhere('ep.region = :region', { region: query.region });
    }
    if (query.industry) {
      qb.andWhere('ep.industry = :industry', { industry: query.industry });
    }
    if (query.search) {
      qb.andWhere('ep.company_name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('ep.created_at', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    const [rawRows, total] = await Promise.all([
      qb.getRawMany<{
        ep_id: string;
        ep_company_name: string | null;
        ep_is_verified: boolean;
        ep_hire_count: number;
        ep_created_at: Date;
        ep_updated_at: Date;
        roles_created_count: string;
        offers_sent_count: string;
      }>(),
      qb.getCount(),
    ]);

    const now = Date.now();
    const items: EmployerListRow[] = rawRows.map((row) => ({
      id: row.ep_id,
      company_name: row.ep_company_name,
      is_verified: row.ep_is_verified,
      package_tier: PACKAGE_TIER_PLACEHOLDER,
      hire_count: row.ep_hire_count,
      offers_sent_count: Number(row.offers_sent_count),
      roles_created_count: Number(row.roles_created_count),
      account_age_days: Math.floor(
        (now - new Date(row.ep_created_at).getTime()) / (24 * 60 * 60 * 1000),
      ),
      last_activity_date: row.ep_updated_at,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(employerProfileId: string) {
    const profile = await this.employerProfileRepo.findOne({
      where: { id: employerProfileId },
      relations: ['user'],
    });
    if (!profile) {
      throw new NotFoundException('Employer not found');
    }

    const [verification, roles, offers] = await Promise.all([
      this.verificationService.getVerificationStatusDetail(profile.user_id),
      this.employerRoleRepo.find({
        where: { employer_user_id: profile.user_id },
        order: { created_at: 'DESC' },
      }),
      this.offerRepo.find({
        where: { employer_user_id: profile.user_id },
        order: { created_at: 'DESC' },
        relations: ['candidate'],
      }),
    ]);

    const hireHistory = offers.filter((o) => o.status === OfferStatus.ACCEPTED);

    return {
      company_profile: {
        name: profile.company_name,
        website: profile.company_website ?? profile.website_url,
        industry: profile.industry,
        size: profile.company_size,
        region: profile.region,
        linkedin:
          profile.linkedin_company_page_url ?? profile.linkedin_company_url,
      },
      verification_status: verification,
      package_and_subscription: {
        package_tier: PACKAGE_TIER_PLACEHOLDER,
        subscription_status: PACKAGE_TIER_PLACEHOLDER,
      },
      roles_created: {
        items: roles.map((r) => ({
          id: r.id,
          title: r.title,
          status: r.status === EmployerRoleStatus.ACTIVE ? 'Active' : 'Closed',
        })),
        empty_message: roles.length === 0 ? 'No roles created yet.' : null,
      },
      offers_sent: {
        items: offers.map((o) => ({
          id: o.id,
          candidate_name: o.candidate?.fullname ?? null,
          role_title: o.role_title,
          status: o.status,
          created_at: o.created_at,
        })),
        empty_message: offers.length === 0 ? 'No offers sent yet.' : null,
      },
      hire_history: {
        hire_count: profile.hire_count,
        items: hireHistory.map((o) => ({
          id: o.id,
          candidate_name: o.candidate?.fullname ?? null,
          role_title: o.role_title,
          hired_at: o.responded_at,
        })),
      },
      account_info: {
        signup_date: profile.created_at,
        account_age_days: Math.floor(
          (Date.now() - profile.created_at.getTime()) / (24 * 60 * 60 * 1000),
        ),
      },
    };
  }
}
