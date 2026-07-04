import { AdminOverviewService } from './admin-overview.service';
import { UserRole } from '../../users/entities/user.entity';

/** Builds a chainable query-builder mock that resolves getCount/getRawMany to a fixed value. */
const buildQueryBuilder = (resolvedValue: unknown) => {
  const qb: Record<string, jest.Mock> = {
    where: jest.fn(),
    andWhere: jest.fn(),
    innerJoin: jest.fn(),
    select: jest.fn(),
    getCount: jest.fn().mockResolvedValue(resolvedValue),
    getRawMany: jest.fn().mockResolvedValue(resolvedValue),
  };
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.innerJoin.mockReturnValue(qb);
  qb.select.mockReturnValue(qb);
  return qb;
};

describe('AdminOverviewService', () => {
  describe('getStats trend computation', () => {
    let service: AdminOverviewService;
    let userRepo: { count: jest.Mock; createQueryBuilder: jest.Mock };
    let talentProfileRepo: { count: jest.Mock; createQueryBuilder: jest.Mock };
    let employerProfileRepo: {
      count: jest.Mock;
      createQueryBuilder: jest.Mock;
    };
    let offerRepo: { createQueryBuilder: jest.Mock };

    const queueCountQueryBuilder = (
      repo: { createQueryBuilder: jest.Mock },
      values: number[],
    ) => {
      let i = 0;
      repo.createQueryBuilder.mockImplementation(() =>
        buildQueryBuilder(values[i++]),
      );
    };

    beforeEach(() => {
      userRepo = { count: jest.fn(), createQueryBuilder: jest.fn() };
      talentProfileRepo = { count: jest.fn(), createQueryBuilder: jest.fn() };
      employerProfileRepo = {
        count: jest.fn(),
        createQueryBuilder: jest.fn(),
      };
      offerRepo = { createQueryBuilder: jest.fn() };

      service = new AdminOverviewService(
        userRepo as never,
        talentProfileRepo as never,
        employerProfileRepo as never,
        offerRepo as never,
        {} as never,
        {} as never,
      );
    });

    it('reports an up trend when the metric grew vs the prior period', async () => {
      userRepo.count.mockResolvedValue(120);
      queueCountQueryBuilder(userRepo, [100]); // candidates 30d ago
      talentProfileRepo.count.mockResolvedValue(60); // job ready now
      queueCountQueryBuilder(talentProfileRepo, [40, 80]); // job ready prior, total candidates prior
      employerProfileRepo.count.mockResolvedValue(10);
      queueCountQueryBuilder(employerProfileRepo, [8]);
      queueCountQueryBuilder(offerRepo, [5, 4]);

      const stats = await service.getStats();

      expect(stats.total_candidates.value).toBe(120);
      expect(stats.total_candidates.trend).toEqual({
        direction: 'up',
        change_percent: 20,
      });
      expect(stats.active_employers.trend.direction).toBe('up');
    });

    it('reports a down trend when the metric shrank vs the prior period', async () => {
      userRepo.count.mockResolvedValue(80);
      queueCountQueryBuilder(userRepo, [100]);
      talentProfileRepo.count.mockResolvedValue(10);
      queueCountQueryBuilder(talentProfileRepo, [40, 80]);
      employerProfileRepo.count.mockResolvedValue(5);
      queueCountQueryBuilder(employerProfileRepo, [8]);
      queueCountQueryBuilder(offerRepo, [2, 4]);

      const stats = await service.getStats();

      expect(stats.total_candidates.trend.direction).toBe('down');
      expect(stats.offers_sent_this_month.trend.direction).toBe('down');
    });

    it('reports no trend when there is no prior-period baseline', async () => {
      userRepo.count.mockResolvedValue(0);
      queueCountQueryBuilder(userRepo, [0]);
      talentProfileRepo.count.mockResolvedValue(0);
      queueCountQueryBuilder(talentProfileRepo, [0, 0]);
      employerProfileRepo.count.mockResolvedValue(0);
      queueCountQueryBuilder(employerProfileRepo, [0]);
      queueCountQueryBuilder(offerRepo, [0, 0]);

      const stats = await service.getStats();

      expect(stats.total_candidates.trend).toEqual({
        direction: null,
        change_percent: null,
      });
    });

    it('always returns a zero-value revenue slot with no trend (no payments system yet)', async () => {
      userRepo.count.mockResolvedValue(10);
      queueCountQueryBuilder(userRepo, [10]);
      talentProfileRepo.count.mockResolvedValue(5);
      queueCountQueryBuilder(talentProfileRepo, [5, 10]);
      employerProfileRepo.count.mockResolvedValue(2);
      queueCountQueryBuilder(employerProfileRepo, [2]);
      queueCountQueryBuilder(offerRepo, [1, 1]);

      const stats = await service.getStats();

      expect(stats.total_revenue).toEqual({
        value: 0,
        trend: { direction: null, change_percent: null },
      });
    });
  });

  describe('getScoreDistribution', () => {
    let service: AdminOverviewService;
    let assessmentResultRepo: { createQueryBuilder: jest.Mock };

    beforeEach(() => {
      assessmentResultRepo = { createQueryBuilder: jest.fn() };
      service = new AdminOverviewService(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        assessmentResultRepo as never,
        {} as never,
      );
    });

    it('flags empty when fewer than 10 completed assessments exist', async () => {
      const rows = Array.from({ length: 5 }, () => ({ percentage: 50 }));
      assessmentResultRepo.createQueryBuilder.mockReturnValue(
        buildQueryBuilder(rows),
      );

      const result = await service.getScoreDistribution();

      expect(result.empty).toBe(true);
      expect(result.total_completed).toBe(5);
    });

    it('buckets percentages into 10-point ranges', async () => {
      const rows = [
        { percentage: 5 },
        { percentage: 15 },
        { percentage: 15 },
        { percentage: 99 },
        ...Array.from({ length: 6 }, () => ({ percentage: 50 })),
      ];
      assessmentResultRepo.createQueryBuilder.mockReturnValue(
        buildQueryBuilder(rows),
      );

      const result = await service.getScoreDistribution();

      expect(result.empty).toBe(false);
      expect(result.total_completed).toBe(10);
      expect(result.buckets.find((b) => b.range === '0-9')?.count).toBe(1);
      expect(result.buckets.find((b) => b.range === '10-19')?.count).toBe(2);
      expect(result.buckets.find((b) => b.range === '50-59')?.count).toBe(6);
      expect(result.buckets.find((b) => b.range === '90-99')?.count).toBe(1);
    });
  });

  describe('getNewUsers', () => {
    let service: AdminOverviewService;
    let userRepo: { findAndCount: jest.Mock };
    let talentProfileRepo: { find: jest.Mock };
    let employerProfileRepo: { find: jest.Mock };

    beforeEach(() => {
      userRepo = { findAndCount: jest.fn() };
      talentProfileRepo = { find: jest.fn().mockResolvedValue([]) };
      employerProfileRepo = { find: jest.fn().mockResolvedValue([]) };

      service = new AdminOverviewService(
        userRepo as never,
        talentProfileRepo as never,
        employerProfileRepo as never,
        {} as never,
        {} as never,
        {} as never,
      );
    });

    it('maps talent and employer rows with their respective status labels', async () => {
      const createdAt = new Date('2026-01-01T00:00:00Z');
      userRepo.findAndCount.mockResolvedValue([
        [
          {
            id: 'talent-1',
            role: UserRole.TALENT,
            fullname: 'Tina Talent',
            createdAt,
          },
          {
            id: 'employer-1',
            role: UserRole.EMPLOYER,
            fullname: 'Eve Employer',
            createdAt,
          },
        ],
        2,
      ]);
      talentProfileRepo.find.mockResolvedValue([
        { user_id: 'talent-1', status: 'job_ready' },
      ]);
      employerProfileRepo.find.mockResolvedValue([
        { user_id: 'employer-1', is_verified: true, company_name: 'Acme' },
      ]);

      const result = await service.getNewUsers({ page: 1, limit: 20 });

      expect(result.items).toEqual([
        {
          name: 'Tina Talent',
          type: 'talent',
          signup_date: createdAt,
          status: 'Job Ready',
        },
        {
          name: 'Acme',
          type: 'employer',
          signup_date: createdAt,
          status: 'Verified',
        },
      ]);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });
  });
});
