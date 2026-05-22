import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OffersService } from './offers.service';
import { Offer, OfferStatus } from './entities/offer.entity';
import { OfferDistributionLog } from './entities/offer-distribution-log.entity';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import { User } from '../users/entities/user.entity';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';

describe('OffersService', () => {
  let service: OffersService;

  const mockOfferRepo = {
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    manager: {
      save: jest.fn(),
      transaction: jest.fn(),
    },
  };

  const mockDistributionLogRepo = {
    save: jest.fn(),
    count: jest.fn(),
  };

  const mockPoolProfileRepo = {
    findOne: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockNotificationDispatch = {
    dispatch: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        { provide: getRepositoryToken(Offer), useValue: mockOfferRepo },
        {
          provide: getRepositoryToken(OfferDistributionLog),
          useValue: mockDistributionLogRepo,
        },
        {
          provide: getRepositoryToken(EmployerPoolProfile),
          useValue: mockPoolProfileRepo,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        {
          provide: NotificationDispatchService,
          useValue: mockNotificationDispatch,
        },
      ],
    }).compile();

    service = module.get<OffersService>(OffersService);
    jest.clearAllMocks();
  });

  describe('createOffer', () => {
    const dto = {
      candidateUserId: 'candidate-1',
      roleTitle: 'Frontend Developer',
      message: 'We would like to offer you a position',
      expiresInDays: 14,
    };

    it('should create an offer for a job_ready candidate', async () => {
      const pool = {
        id: 'pool-1',
        candidate_id: 'candidate-1',
        tier: 'job_ready',
      };
      mockPoolProfileRepo.findOne.mockResolvedValue(pool);
      mockOfferRepo.manager.transaction.mockImplementation(
        async (
          cb: (manager: typeof mockOfferRepo.manager) => Promise<unknown>,
        ) => {
          const manager = {
            count: jest.fn().mockResolvedValue(0),
            save: jest
              .fn()
              .mockResolvedValueOnce({
                id: 'offer-1',
                employer_user_id: 'employer-1',
                candidate_user_id: dto.candidateUserId,
                role_title: dto.roleTitle,
                status: OfferStatus.PENDING,
              })
              .mockResolvedValueOnce({ id: 'log-1' }),
          };
          return cb(manager as unknown as typeof mockOfferRepo.manager);
        },
      );
      mockUserRepo.findOne.mockResolvedValue({
        id: 'employer-1',
        first_name: 'Jane',
        last_name: 'Employer',
      });
      mockNotificationDispatch.dispatch.mockResolvedValue(undefined);

      const result = await service.createOffer('employer-1', dto);

      expect(result.id).toBe('offer-1');
      expect(mockOfferRepo.manager.transaction).toHaveBeenCalled();
      expect(mockNotificationDispatch.dispatch).toHaveBeenCalled();
    });

    it('should throw NotFoundError if candidate not in pool', async () => {
      mockPoolProfileRepo.findOne.mockResolvedValue(null);

      await expect(service.createOffer('employer-1', dto)).rejects.toThrow(
        'Candidate not found',
      );
    });

    it('should throw ForbiddenError if candidate is not job_ready', async () => {
      const pool = {
        id: 'pool-1',
        candidate_id: 'candidate-1',
        tier: 'emerging',
      };
      mockPoolProfileRepo.findOne.mockResolvedValue(pool);

      await expect(service.createOffer('employer-1', dto)).rejects.toThrow(
        'Offers can only be sent to Job Ready candidates',
      );
    });

    it('should throw TooManyRequestsError if monthly cap reached', async () => {
      const pool = {
        id: 'pool-1',
        candidate_id: 'candidate-1',
        tier: 'job_ready',
      };
      mockPoolProfileRepo.findOne.mockResolvedValue(pool);
      mockOfferRepo.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => {
          const manager = { count: jest.fn().mockResolvedValue(50) };
          return cb(manager);
        },
      );

      await expect(service.createOffer('employer-1', dto)).rejects.toThrow(
        'Monthly offer limit reached',
      );
    });
  });

  describe('respondToOffer', () => {
    it('should accept a pending offer', async () => {
      const offer = {
        id: 'offer-1',
        candidate_user_id: 'candidate-1',
        employer_user_id: 'employer-1',
        role_title: 'Dev',
        status: OfferStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000),
      };
      mockOfferRepo.findOne.mockResolvedValue(offer);
      // First update: expire check (not expired → affected=0)
      // Second update: respond (affected=1)
      mockOfferRepo.update
        .mockResolvedValueOnce({ affected: 0 })
        .mockResolvedValueOnce({ affected: 1 });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'candidate-1',
        first_name: 'Bob',
        last_name: 'Candidate',
      });
      mockNotificationDispatch.dispatch.mockResolvedValue(undefined);

      const result = await service.respondToOffer(
        'candidate-1',
        'offer-1',
        'accept',
      );

      expect(result.status).toBe(OfferStatus.ACCEPTED);
      expect(mockNotificationDispatch.dispatch).toHaveBeenCalled();
    });

    it('should decline a pending offer', async () => {
      const offer = {
        id: 'offer-1',
        candidate_user_id: 'candidate-1',
        employer_user_id: 'employer-1',
        role_title: 'Dev',
        status: OfferStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000),
      };
      mockOfferRepo.findOne.mockResolvedValue(offer);
      mockOfferRepo.update
        .mockResolvedValueOnce({ affected: 0 })
        .mockResolvedValueOnce({ affected: 1 });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'candidate-1',
        first_name: 'Bob',
        last_name: 'Candidate',
      });
      mockNotificationDispatch.dispatch.mockResolvedValue(undefined);

      const result = await service.respondToOffer(
        'candidate-1',
        'offer-1',
        'decline',
      );

      expect(result.status).toBe(OfferStatus.DECLINED);
    });

    it('should throw NotFoundError if offer not found', async () => {
      mockOfferRepo.findOne.mockResolvedValue(null);

      await expect(
        service.respondToOffer('candidate-1', 'missing', 'accept'),
      ).rejects.toThrow('Offer not found');
    });

    it('should throw BadRequestError if offer is not pending', async () => {
      const offer = {
        id: 'offer-1',
        candidate_user_id: 'candidate-1',
        status: OfferStatus.ACCEPTED,
        expires_at: new Date(Date.now() + 86400000),
      };
      mockOfferRepo.findOne.mockResolvedValue(offer);

      await expect(
        service.respondToOffer('candidate-1', 'offer-1', 'accept'),
      ).rejects.toThrow('Cannot respond to an offer with status');
    });

    it('should throw BadRequestError if offer is expired', async () => {
      const offer = {
        id: 'offer-1',
        candidate_user_id: 'candidate-1',
        employer_user_id: 'employer-1',
        status: OfferStatus.PENDING,
        expires_at: new Date(Date.now() - 86400000), // expired yesterday
      };
      mockOfferRepo.findOne.mockResolvedValue(offer);
      // Expire check succeeds (affected=1 → offer was expired)
      mockOfferRepo.update.mockResolvedValue({ affected: 1 });

      await expect(
        service.respondToOffer('candidate-1', 'offer-1', 'accept'),
      ).rejects.toThrow('This offer has expired');
    });
  });

  describe('getAnalytics', () => {
    it('should return offer analytics', async () => {
      // expireStaleOffers update call
      mockOfferRepo.update.mockResolvedValue({ affected: 0 });
      mockDistributionLogRepo.count.mockResolvedValue(5);
      mockOfferRepo.count
        .mockResolvedValueOnce(3) // accepted
        .mockResolvedValueOnce(1) // declined
        .mockResolvedValueOnce(2) // pending
        .mockResolvedValueOnce(0); // expired

      const result = await service.getAnalytics('employer-1');

      expect(result.offersThisMonth).toBe(5);
      expect(result.acceptedCount).toBe(3);
      expect(result.declinedCount).toBe(1);
      expect(result.pendingCount).toBe(2);
      expect(result.expiredCount).toBe(0);
      expect(result.remaining).toBe(45);
    });
  });

  describe('listEmployerOffers - expiry marking', () => {
    it('should bulk-expire stale PENDING offers before querying', async () => {
      // expireStaleOffers update called first
      mockOfferRepo.update.mockResolvedValue({ affected: 1 });
      // After expiry, findAndCount returns the updated state
      const activeOffer = {
        id: 'offer-2',
        employer_user_id: 'employer-1',
        status: OfferStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000),
      };
      mockOfferRepo.findAndCount.mockResolvedValue([[activeOffer], 1]);

      const result = await service.listEmployerOffers('employer-1', {});

      expect(result.offers[0].status).toBe(OfferStatus.PENDING);
      expect(mockOfferRepo.update).toHaveBeenCalled();
    });

    it('should return offers as-is when no expiry needed', async () => {
      mockOfferRepo.update.mockResolvedValue({ affected: 0 });
      const activeOffer = {
        id: 'offer-1',
        employer_user_id: 'employer-1',
        status: OfferStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000),
      };
      mockOfferRepo.findAndCount.mockResolvedValue([[activeOffer], 1]);

      const result = await service.listEmployerOffers('employer-1', {});

      expect(result.offers[0].status).toBe(OfferStatus.PENDING);
    });

    it('should not affect already accepted/declined offers', async () => {
      mockOfferRepo.update.mockResolvedValue({ affected: 0 });
      const acceptedOffer = {
        id: 'offer-1',
        employer_user_id: 'employer-1',
        status: OfferStatus.ACCEPTED,
        expires_at: new Date(Date.now() - 86400000), // old but already accepted
      };
      mockOfferRepo.findAndCount.mockResolvedValue([[acceptedOffer], 1]);

      const result = await service.listEmployerOffers('employer-1', {});

      expect(result.offers[0].status).toBe(OfferStatus.ACCEPTED);
    });
  });
});
