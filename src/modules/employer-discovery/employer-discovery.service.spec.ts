import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmployerDiscoveryService } from './employer-discovery.service';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import { EmployerSavedCandidate } from './entities/employer-saved-candidate.entity';
import { EmployerContactRequest } from './entities/employer-contact-request.entity';
import { User } from '../users/entities/user.entity';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import { EmployerVerificationService } from '../employer/employer-verification.service';
import { ForbiddenError } from '../../shared';
import { Offer } from '../offers/entities/offer.entity';

describe('EmployerDiscoveryService', () => {
  let service: EmployerDiscoveryService;

  const mockPoolProfileRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };

  const mockSavedCandidateRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockContactRequestRepo = {
    save: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockOfferRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockNotificationDispatch = {
    dispatch: jest.fn(),
  };

  const mockVerificationService = {
    assertEmployerVerified: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployerDiscoveryService,
        {
          provide: getRepositoryToken(EmployerPoolProfile),
          useValue: mockPoolProfileRepo,
        },
        {
          provide: getRepositoryToken(EmployerSavedCandidate),
          useValue: mockSavedCandidateRepo,
        },
        {
          provide: getRepositoryToken(EmployerContactRequest),
          useValue: mockContactRequestRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(Offer),
          useValue: mockOfferRepo,
        },
        {
          provide: NotificationDispatchService,
          useValue: mockNotificationDispatch,
        },
        {
          provide: EmployerVerificationService,
          useValue: mockVerificationService,
        },
      ],
    }).compile();

    service = module.get<EmployerDiscoveryService>(EmployerDiscoveryService);
    jest.clearAllMocks();
    mockVerificationService.assertEmployerVerified.mockResolvedValue(undefined);
    mockOfferRepo.createQueryBuilder.mockReturnValue(createOfferQb());
  });

  const createOfferQb = (
    rows: Array<{
      offer_candidate_user_id: string;
      offer_status: string;
    }> = [],
  ) => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  });

  describe('getCandidateProfile', () => {
    it('should return profile for job_ready candidate', async () => {
      const pool = {
        id: 'pool-1',
        candidate_id: 'user-1',
        tier: 'job_ready',
        track: 'frontend_developer',
      };
      mockPoolProfileRepo.findOne.mockResolvedValue(pool);
      mockOfferRepo.createQueryBuilder.mockReturnValue(
        createOfferQb([
          {
            offer_candidate_user_id: 'user-1',
            offer_status: 'pending',
          },
        ]),
      );

      const result = await service.getCandidateProfile('employer-1', 'user-1');
      expect(result.id).toBe(pool.id);
      expect(result.candidate_id).toBe(pool.candidate_id);
      expect(result.tier).toBe(pool.tier);
      expect(result.track).toBe(pool.track);
      expect(result.offer_sent).toBe(true);
      expect(result.offer_status).toBe('pending');
    });

    it('should throw NotFoundError if candidate not in pool', async () => {
      mockPoolProfileRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getCandidateProfile('employer-1', 'missing'),
      ).rejects.toThrow('Candidate profile not found');
    });

    it('should throw ForbiddenError if candidate is not job_ready', async () => {
      const pool = {
        id: 'pool-1',
        candidate_id: 'user-1',
        tier: 'emerging',
      };
      mockPoolProfileRepo.findOne.mockResolvedValue(pool);

      await expect(
        service.getCandidateProfile('employer-1', 'user-1'),
      ).rejects.toThrow('Only Job Ready candidates are accessible to employers');
    });
  });

  describe('saveCandidate', () => {
    it('should save a job_ready candidate', async () => {
      const pool = { id: 'pool-1', candidate_id: 'user-1', tier: 'job_ready' };
      mockPoolProfileRepo.findOne.mockResolvedValue(pool);
      mockSavedCandidateRepo.save.mockResolvedValue({ id: 'saved-1' });

      const result = await service.saveCandidate(
        'employer-1',
        'user-1',
        'Great candidate',
      );

      expect(result.status).toBe('success');
      expect(mockSavedCandidateRepo.save).toHaveBeenCalledWith({
        employer_user_id: 'employer-1',
        candidate_user_id: 'user-1',
        employer_pool_profile_id: 'pool-1',
        notes: 'Great candidate',
      });
    });

    it('should throw ConflictError if already saved', async () => {
      const pool = { id: 'pool-1', candidate_id: 'user-1', tier: 'job_ready' };
      mockPoolProfileRepo.findOne.mockResolvedValue(pool);
      const duplicateError = Object.assign(new Error('duplicate'), {
        code: '23505',
      });
      mockSavedCandidateRepo.save.mockRejectedValue(duplicateError);

      await expect(
        service.saveCandidate('employer-1', 'user-1'),
      ).rejects.toThrow('Candidate already saved');
    });

    it('should throw ForbiddenError if candidate not job_ready', async () => {
      const pool = { id: 'pool-1', candidate_id: 'user-1', tier: 'emerging' };
      mockPoolProfileRepo.findOne.mockResolvedValue(pool);

      await expect(
        service.saveCandidate('employer-1', 'user-1'),
      ).rejects.toThrow('Only Job Ready candidates can be saved');
    });
  });

  describe('unsaveCandidate', () => {
    it('should remove a saved candidate', async () => {
      mockSavedCandidateRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.unsaveCandidate('employer-1', 'user-1');
      expect(result.status).toBe('success');
    });

    it('should throw NotFoundError if not saved', async () => {
      mockSavedCandidateRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(
        service.unsaveCandidate('employer-1', 'user-1'),
      ).rejects.toThrow('Saved candidate not found');
    });
  });

  describe('contactCandidate', () => {
    it('should throw ForbiddenError if employer is not verified', async () => {
      mockVerificationService.assertEmployerVerified.mockRejectedValue(
        new ForbiddenError(
          'Complete your company profile to access this feature.',
        ),
      );

      await expect(
        service.contactCandidate('employer-1', 'user-1', 'Hello'),
      ).rejects.toThrow(
        'Complete your company profile to access this feature.',
      );
      expect(mockPoolProfileRepo.findOne).not.toHaveBeenCalled();
    });

    it('should create contact request and trigger notification', async () => {
      const pool = { id: 'pool-1', candidate_id: 'user-1', tier: 'job_ready' };
      mockPoolProfileRepo.findOne.mockResolvedValue(pool);
      mockContactRequestRepo.save.mockResolvedValue({ id: 'contact-1' });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'employer-1',
        first_name: 'John',
        last_name: 'Doe',
      });
      mockNotificationDispatch.dispatch.mockResolvedValue(undefined);

      const result = await service.contactCandidate(
        'employer-1',
        'user-1',
        'Interested in your profile',
      );

      expect(result.status).toBe('success');
      expect(mockContactRequestRepo.save).toHaveBeenCalled();
      expect(mockNotificationDispatch.dispatch).toHaveBeenCalled();
    });

    it('should throw ForbiddenError if candidate not job_ready', async () => {
      const pool = {
        id: 'pool-1',
        candidate_id: 'user-1',
        tier: 'not_ready',
      };
      mockPoolProfileRepo.findOne.mockResolvedValue(pool);

      await expect(
        service.contactCandidate('employer-1', 'user-1', 'Hello'),
      ).rejects.toThrow('Only Job Ready candidates can be contacted');
    });

    it('should succeed even if notification dispatch throws', async () => {
      const pool = { id: 'pool-1', candidate_id: 'user-1', tier: 'job_ready' };
      mockPoolProfileRepo.findOne.mockResolvedValue(pool);
      mockContactRequestRepo.save.mockResolvedValue({ id: 'contact-1' });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'employer-1',
        first_name: 'John',
        last_name: 'Doe',
      });
      mockNotificationDispatch.dispatch.mockRejectedValue(
        new Error('Email service down'),
      );

      const result = await service.contactCandidate(
        'employer-1',
        'user-1',
        'Interested',
      );

      expect(result.status).toBe('success');
    });
  });

  describe('discoverCandidates', () => {
    const createMockQb = (rawResults: unknown[] = [], count = 0) => {
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(count),
        getRawMany: jest.fn().mockResolvedValue(rawResults),
      };
      return qb;
    };

    const createSavedQb = (savedIds: string[] = []) => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue(
            savedIds.map((id) => ({ s_candidate_user_id: id })),
          ),
      };
      return qb;
    };

    it('should return paginated candidates with isSaved flag', async () => {
      const rawResults = [
        {
          poolId: 'pool-1',
          userId: 'user-1',
          roleTrack: 'frontend_developer',
          tier: 'job_ready',
          availability: 'immediate',
          verifiedAt: new Date(),
          score: 85,
          strongCompetencies: ['React'],
          shareToken: 'abc',
          firstName: 'Alice',
          lastName: 'Dev',
        },
      ];
      const poolQb = createMockQb(rawResults, 1);
      mockPoolProfileRepo.createQueryBuilder.mockReturnValue(poolQb);

      const savedQb = createSavedQb(['user-1']);
      mockSavedCandidateRepo.createQueryBuilder.mockReturnValue(savedQb);

      const result = await service.discoverCandidates('employer-1', {
        page: 1,
        limit: 20,
      });

      expect(result.total).toBe(1);
      expect(result.candidates[0].user_id).toBe('user-1');
      expect(result.candidates[0].full_name).toBe('Alice Dev');
      expect(result.candidates[0].is_saved).toBe(true);
      expect(result.total_pages).toBe(1);
    });

    it('should return empty results when no candidates match', async () => {
      const poolQb = createMockQb([], 0);
      mockPoolProfileRepo.createQueryBuilder.mockReturnValue(poolQb);

      const result = await service.discoverCandidates('employer-1', {
        page: 1,
        limit: 20,
      });

      expect(result.total).toBe(0);
      expect(result.candidates).toHaveLength(0);
    });

    it('should apply roleTrack filter', async () => {
      const poolQb = createMockQb([], 0);
      mockPoolProfileRepo.createQueryBuilder.mockReturnValue(poolQb);

      await service.discoverCandidates('employer-1', {
        page: 1,
        limit: 20,
        role_track: 'backend_developer',
      });

      expect(poolQb.andWhere).toHaveBeenCalledWith('pool.track = :roleTrack', {
        roleTrack: 'backend_developer',
      });
    });

    it('should apply availability filter', async () => {
      const poolQb = createMockQb([], 0);
      mockPoolProfileRepo.createQueryBuilder.mockReturnValue(poolQb);

      await service.discoverCandidates('employer-1', {
        page: 1,
        limit: 20,
        availability: 'immediate',
      });

      expect(poolQb.andWhere).toHaveBeenCalledWith(
        'pool.availability = :availability',
        { availability: 'immediate' },
      );
    });

    it('should apply search filter', async () => {
      const poolQb = createMockQb([], 0);
      mockPoolProfileRepo.createQueryBuilder.mockReturnValue(poolQb);

      await service.discoverCandidates('employer-1', {
        page: 1,
        limit: 20,
        search: 'Alice',
      });

      expect(poolQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        { search: '%Alice%' },
      );
    });

    it('should mark candidates as not saved when none are saved', async () => {
      const rawResults = [
        {
          poolId: 'pool-1',
          userId: 'user-1',
          roleTrack: 'frontend_developer',
          tier: 'job_ready',
          availability: 'immediate',
          verifiedAt: new Date(),
          score: 80,
          strongCompetencies: null,
          shareToken: null,
          firstName: 'Bob',
          lastName: null,
        },
      ];
      const poolQb = createMockQb(rawResults, 1);
      mockPoolProfileRepo.createQueryBuilder.mockReturnValue(poolQb);

      const savedQb = createSavedQb([]);
      mockSavedCandidateRepo.createQueryBuilder.mockReturnValue(savedQb);

      const result = await service.discoverCandidates('employer-1', {
        page: 1,
        limit: 20,
      });

      expect(result.candidates[0].is_saved).toBe(false);
      expect(result.candidates[0].full_name).toBe('Bob');
    });
  });
});
