import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployerPackage } from '../../payments/entities/employer-package.entity';
import {
  EmployerSubscription,
  EmployerSubscriptionStatus,
} from '../../payments/entities/employer-subscription.entity';
import {
  TalentSubscription,
  TalentSubscriptionStatus,
} from '../../payments/entities/talent-subscription.entity';
import {
  SubscriberType,
  Transaction,
  TransactionStatus,
} from '../../payments/entities/transaction.entity';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions-query.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { RevenueChartQueryDto } from './dto/revenue-chart-query.dto';

export interface StatCards {
  total_revenue: { value: number; currency: string };
  active_employer_subscriptions: number;
  active_talent_subscriptions: number;
  failed_payment_count: number;
}

export interface RevenueChartData {
  employer_revenue: { period: string; amount: number }[];
  talent_revenue: { period: string; amount: number }[];
}

export interface EmployerPackageRow {
  id: string;
  name: string;
  price: number;
  offer_limit: number | null;
  features: Record<string, unknown> | null;
  is_free: boolean;
}

export interface SubscriptionRow {
  id: string;
  subscriber_name: string;
  type: 'employer' | 'talent';
  package_tier: string | null;
  monthly_price: number | null;
  status: string;
  start_date: Date;
  next_billing_date: Date | null;
  days_left_in_grace: number | null;
}

export interface TransactionRow {
  id: string;
  subscriber_name: string;
  type: string;
  amount: number;
  currency: string;
  date: Date;
  status: string;
  linked_subscription_id: string | null;
}

export interface TalentSubscriptionSummary {
  total_active: number;
  total_cancelled: number;
  monthly_price: number | null;
}

@Injectable()
export class AdminPaymentsService {
  constructor(
    @InjectRepository(EmployerPackage)
    private readonly employerPackageRepo: Repository<EmployerPackage>,
    @InjectRepository(EmployerSubscription)
    private readonly employerSubscriptionRepo: Repository<EmployerSubscription>,
    @InjectRepository(TalentSubscription)
    private readonly talentSubscriptionRepo: Repository<TalentSubscription>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

  async getStats(): Promise<StatCards> {
    const [
      totalRevenueResult,
      activeEmployerCount,
      activeTalentCount,
      failedCount,
    ] = await Promise.all([
      this.transactionRepo
        .createQueryBuilder('txn')
        .select('COALESCE(SUM(txn.amount), 0)', 'total')
        .where('txn.status = :status', {
          status: TransactionStatus.SUCCESSFUL,
        })
        .getRawOne<{ total: string }>(),
      this.employerSubscriptionRepo.count({
        where: { status: EmployerSubscriptionStatus.ACTIVE },
      }),
      this.talentSubscriptionRepo.count({
        where: { status: TalentSubscriptionStatus.ACTIVE },
      }),
      this.transactionRepo.count({
        where: { status: TransactionStatus.FAILED },
      }),
    ]);

    return {
      total_revenue: {
        value: Number(totalRevenueResult?.total ?? 0),
        currency: 'USD',
      },
      active_employer_subscriptions: activeEmployerCount,
      active_talent_subscriptions: activeTalentCount,
      failed_payment_count: failedCount,
    };
  }

  async getRevenueChart(
    query: RevenueChartQueryDto,
  ): Promise<RevenueChartData> {
    const period = query.period ?? 'monthly';

    let dateTrunc: string;
    switch (period) {
      case 'yearly':
        dateTrunc = 'year';
        break;
      case 'weekly':
        dateTrunc = 'week';
        break;
      case 'daily':
        dateTrunc = 'day';
        break;
      default:
        dateTrunc = 'month';
    }

    const [employerRevenue, talentRevenue] = await Promise.all([
      this.transactionRepo
        .createQueryBuilder('txn')
        .select(`DATE_TRUNC('${dateTrunc}', txn.created_at)`, 'period')
        .addSelect('COALESCE(SUM(txn.amount), 0)', 'amount')
        .where('txn.status = :status', {
          status: TransactionStatus.SUCCESSFUL,
        })
        .andWhere('txn.subscriber_type = :type', {
          type: SubscriberType.EMPLOYER,
        })
        .groupBy('period')
        .orderBy('period', 'ASC')
        .getRawMany<{ period: Date; amount: string }>(),
      this.transactionRepo
        .createQueryBuilder('txn')
        .select(`DATE_TRUNC('${dateTrunc}', txn.created_at)`, 'period')
        .addSelect('COALESCE(SUM(txn.amount), 0)', 'amount')
        .where('txn.status = :status', {
          status: TransactionStatus.SUCCESSFUL,
        })
        .andWhere('txn.subscriber_type = :type', {
          type: SubscriberType.TALENT,
        })
        .groupBy('period')
        .orderBy('period', 'ASC')
        .getRawMany<{ period: Date; amount: string }>(),
    ]);

    const mapRow = (row: { period: Date; amount: string }) => ({
      period: row.period.toISOString(),
      amount: Number(row.amount),
    });

    return {
      employer_revenue: employerRevenue.map(mapRow),
      talent_revenue: talentRevenue.map(mapRow),
    };
  }

  async getEmployerPackages(): Promise<EmployerPackageRow[]> {
    const packages = await this.employerPackageRepo.find({
      order: { price: 'ASC' },
    });
    return packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      price: Number(pkg.price),
      offer_limit: pkg.offer_limit,
      features: pkg.features,
      is_free: pkg.is_free,
    }));
  }

  async getSubscriptions(query: ListSubscriptionsQueryDto): Promise<{
    items: SubscriptionRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const employerQb = this.employerSubscriptionRepo
      .createQueryBuilder('es')
      .innerJoinAndSelect('es.employer', 'employer')
      .innerJoinAndSelect('es.package', 'pkg')
      .select([
        'es.id AS id',
        "CONCAT(employer.first_name, ' ', employer.last_name) AS subscriber_name",
        "'employer' AS type",
        'pkg.name AS package_tier',
        'pkg.price AS monthly_price',
        'es.status AS status',
        'es.start_date AS start_date',
        'es.next_billing_date AS next_billing_date',
        'es.grace_period_ends_at AS grace_period_ends_at',
      ]);

    const talentQb = this.talentSubscriptionRepo
      .createQueryBuilder('ts')
      .innerJoinAndSelect('ts.talent', 'talent')
      .select([
        'ts.id AS id',
        "CONCAT(talent.first_name, ' ', talent.last_name) AS subscriber_name",
        "'talent' AS type",
        'NULL AS package_tier',
        'ts.price AS monthly_price',
        'ts.status AS status',
        'ts.start_date AS start_date',
        'ts.next_billing_date AS next_billing_date',
        'NULL AS grace_period_ends_at',
      ]);

    if (query.type === 'employer') {
      return this.paginatedEmployerSubscriptions(
        employerQb,
        query,
        page,
        limit,
      );
    }
    if (query.type === 'talent') {
      return this.paginatedTalentSubscriptions(talentQb, query, page, limit);
    }

    const employerRaw = await employerQb.getRawMany<Record<string, unknown>>();
    const talentRaw = await talentQb.getRawMany<Record<string, unknown>>();

    const allRows = [
      ...this.mapEmployerSubRows(employerRaw),
      ...this.mapTalentSubRows(talentRaw),
    ];

    let filtered = allRows;

    if (query.status) {
      filtered = filtered.filter((r) => r.status === query.status);
    }

    if (query.search) {
      const term = query.search.toLowerCase();
      filtered = filtered.filter((r) =>
        r.subscriber_name.toLowerCase().includes(term),
      );
    }

    filtered.sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
    );

    return this.paginateMerged(filtered, page, limit);
  }

  private async paginatedEmployerSubscriptions(
    qb: import('typeorm').SelectQueryBuilder<EmployerSubscription>,
    query: ListSubscriptionsQueryDto,
    page: number,
    limit: number,
  ) {
    if (query.status) {
      qb.andWhere('es.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        "CONCAT(employer.first_name, ' ', employer.last_name) ILIKE :search",
        { search: `%${query.search}%` },
      );
    }

    const [raw, total] = await Promise.all([
      qb
        .offset((page - 1) * limit)
        .limit(limit)
        .orderBy('es.start_date', 'DESC')
        .getRawMany<Record<string, unknown>>(),
      qb.getCount(),
    ]);

    return {
      items: this.mapEmployerSubRows(raw),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async paginatedTalentSubscriptions(
    qb: import('typeorm').SelectQueryBuilder<TalentSubscription>,
    query: ListSubscriptionsQueryDto,
    page: number,
    limit: number,
  ) {
    if (query.status) {
      qb.andWhere('ts.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        "CONCAT(talent.first_name, ' ', talent.last_name) ILIKE :search",
        { search: `%${query.search}%` },
      );
    }

    const [raw, total] = await Promise.all([
      qb
        .offset((page - 1) * limit)
        .limit(limit)
        .orderBy('ts.start_date', 'DESC')
        .getRawMany<Record<string, unknown>>(),
      qb.getCount(),
    ]);

    return {
      items: this.mapTalentSubRows(raw),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private mapEmployerSubRows(
    raw: Record<string, unknown>[],
  ): SubscriptionRow[] {
    return raw.map((row) => ({
      id: row.id as string,
      subscriber_name: row.subscriber_name as string,
      type: 'employer' as const,
      package_tier: (row.package_tier as string) ?? null,
      monthly_price:
        row.monthly_price != null ? Number(row.monthly_price) : null,
      status: row.status as string,
      start_date: row.start_date as Date,
      next_billing_date: (row.next_billing_date as Date) ?? null,
      days_left_in_grace: this.computeDaysLeftInGrace(
        row.grace_period_ends_at as Date | null,
      ),
    }));
  }

  private mapTalentSubRows(raw: Record<string, unknown>[]): SubscriptionRow[] {
    return raw.map((row) => ({
      id: row.id as string,
      subscriber_name: row.subscriber_name as string,
      type: 'talent' as const,
      package_tier: null,
      monthly_price:
        row.monthly_price != null ? Number(row.monthly_price) : null,
      status: row.status as string,
      start_date: row.start_date as Date,
      next_billing_date: (row.next_billing_date as Date) ?? null,
      days_left_in_grace: null,
    }));
  }

  private computeDaysLeftInGrace(
    gracePeriodEndsAt: Date | null,
  ): number | null {
    if (!gracePeriodEndsAt) return null;
    const diffMs = new Date(gracePeriodEndsAt).getTime() - Date.now();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  }

  private paginateMerged(
    items: SubscriptionRow[],
    page: number,
    limit: number,
    totalOverride?: number,
  ) {
    const total = totalOverride ?? items.length;
    const start = (page - 1) * limit;
    return {
      items: items.slice(start, start + limit),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTransactions(query: ListTransactionsQueryDto): Promise<{
    items: TransactionRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.transactionRepo
      .createQueryBuilder('txn')
      .leftJoinAndSelect('txn.employerSubscription', 'es')
      .leftJoinAndSelect('es.employer', 'employer')
      .leftJoinAndSelect('txn.talentSubscription', 'ts')
      .leftJoinAndSelect('ts.talent', 'talent')
      .select([
        'txn.id AS id',
        "CASE WHEN txn.subscriber_type = 'employer' THEN CONCAT(employer.first_name, ' ', employer.last_name) ELSE CONCAT(talent.first_name, ' ', talent.last_name) END AS subscriber_name",
        'txn.subscriber_type AS type',
        'txn.amount AS amount',
        'txn.currency AS currency',
        'txn.created_at AS date',
        'txn.status AS status',
        'COALESCE(txn.employer_subscription_id, txn.talent_subscription_id) AS linked_subscription_id',
      ]);

    if (query.status) {
      qb.andWhere('txn.status = :status', { status: query.status });
    }
    if (query.dateFrom) {
      qb.andWhere('txn.created_at >= :date_from', {
        date_from: query.dateFrom,
      });
    }
    if (query.dateTo) {
      const dateToEnd = new Date(query.dateTo);
      dateToEnd.setDate(dateToEnd.getDate() + 1);
      qb.andWhere('txn.created_at < :date_to_end', {
        date_to_end: dateToEnd.toISOString().split('T')[0],
      });
    }
    if (query.search) {
      qb.andWhere(
        `(CASE WHEN txn.subscriber_type = 'employer' THEN CONCAT(employer.first_name, ' ', employer.last_name) ELSE CONCAT(talent.first_name, ' ', talent.last_name) END) ILIKE :search`,
        { search: `%${query.search}%` },
      );
    }

    const [raw, total] = await Promise.all([
      qb
        .orderBy('txn.created_at', 'DESC')
        .offset((page - 1) * limit)
        .limit(limit)
        .getRawMany<{
          id: string;
          subscriber_name: string;
          type: string;
          amount: string;
          currency: string;
          date: Date;
          status: string;
          linked_subscription_id: string | null;
        }>(),
      qb.getCount(),
    ]);

    return {
      items: raw.map((row) => ({
        id: row.id,
        subscriber_name: row.subscriber_name,
        type: row.type,
        amount: Number(row.amount),
        currency: row.currency,
        date: row.date,
        status: row.status,
        linked_subscription_id: row.linked_subscription_id,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTalentSubscriptionSummary(): Promise<TalentSubscriptionSummary> {
    const [activeCount, cancelledCount, priceResult] = await Promise.all([
      this.talentSubscriptionRepo.count({
        where: { status: TalentSubscriptionStatus.ACTIVE },
      }),
      this.talentSubscriptionRepo.count({
        where: { status: TalentSubscriptionStatus.CANCELLED },
      }),
      this.talentSubscriptionRepo
        .createQueryBuilder('ts')
        .select('ts.price', 'price')
        .where('ts.price IS NOT NULL')
        .orderBy('ts.price', 'DESC')
        .limit(1)
        .getRawOne<{ price: string }>(),
    ]);

    return {
      total_active: activeCount,
      total_cancelled: cancelledCount,
      monthly_price: priceResult ? Number(priceResult.price) : null,
    };
  }
}
