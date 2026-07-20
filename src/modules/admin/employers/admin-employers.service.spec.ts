import { NotFoundException } from '@nestjs/common';
import { AdminEmployersService } from './admin-employers.service';
import { EmployerRoleStatus } from '../../employer-roles/entities/employer-role.entity';
import { OfferStatus } from '../../offers/entities/offer.entity';

const buildQueryBuilder = (rawMany: unknown[], count: number) => {
  const qb: Record<string, jest.Mock> = {
    subQuery: jest.fn(),
    select: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
    addSelect: jest.fn(),
    getQuery: jest.fn().mockReturnValue('SELECT 1'),
    getRawMany: jest.fn().mockResolvedValue(rawMany),
    getCount: jest.fn().mockResolvedValue(count),
  };
  for (const key of Object.keys(qb)) {
    if (!['getQuery', 'getRawMany', 'getCount'].includes(key)) {
      qb[key].mockReturnValue(qb);
    }
  }
  qb.subQuery.mockReturnValue(qb);
  return qb;
};

describe('AdminEmployersService', () => {
  describe('findAll', () => {
    it('maps raw rows to the list contract with the Free package placeholder', async () => {
      const dayMs = 24 * 60 * 60 * 1000;
      const rawRows = [
        {
          ep_id: 'employer-1',
          ep_company_name: 'Acme Labs',
          ep_is_verified: true,
          ep_hire_count: 3,
          ep_created_at: new Date(Date.now() - 10 * dayMs),
          ep_updated_at: new Date(),
          roles_created_count: '4',
          offers_sent_count: '7',
        },
      ];
      const employerProfileRepo = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValue(buildQueryBuilder(rawRows, 1)),
      };

      const service = new AdminEmployersService(
        employerProfileRepo as never,
        {} as never,
        {} as never,
        {} as never,
      );

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items[0]).toMatchObject({
        id: 'employer-1',
        company_name: 'Acme Labs',
        is_verified: true,
        package_tier: 'Free',
        hire_count: 3,
        offers_sent_count: 7,
        roles_created_count: 4,
        account_age_days: 10,
      });
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    let employerProfileRepo: { findOne: jest.Mock };
    let employerRoleRepo: { find: jest.Mock };
    let offerRepo: { find: jest.Mock };
    let verificationService: { getVerificationStatusDetail: jest.Mock };
    let service: AdminEmployersService;

    const baseProfile = {
      id: 'profile-1',
      user_id: 'employer-user-1',
      user: { fullname: 'Eve Employer' },
      company_name: 'Acme Labs',
      company_website: 'https://acme.example',
      website_url: null,
      industry: 'Tech',
      company_size: '11-50',
      region: 'Nigeria',
      linkedin_company_page_url: 'https://linkedin.com/company/acme',
      linkedin_company_url: null,
      hire_count: 2,
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    };

    beforeEach(() => {
      employerProfileRepo = { findOne: jest.fn() };
      employerRoleRepo = { find: jest.fn().mockResolvedValue([]) };
      offerRepo = { find: jest.fn().mockResolvedValue([]) };
      verificationService = {
        getVerificationStatusDetail: jest.fn().mockResolvedValue({
          verified: true,
          criteria: {
            email_verified: true,
            website_resolvable: true,
            linkedin_provided: true,
          },
          banner_visible: false,
        }),
      };

      service = new AdminEmployersService(
        employerProfileRepo as never,
        employerRoleRepo as never,
        offerRepo as never,
        verificationService as never,
      );
    });

    it('throws NotFoundException when the employer does not exist', async () => {
      employerProfileRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns company profile fields with website/linkedin fallback chains', async () => {
      employerProfileRepo.findOne.mockResolvedValue(baseProfile);

      const result = await service.findOne('profile-1');

      expect(result.company_profile).toEqual({
        name: 'Acme Labs',
        website: 'https://acme.example',
        industry: 'Tech',
        size: '11-50',
        region: 'Nigeria',
        linkedin: 'https://linkedin.com/company/acme',
      });
    });

    it('delegates verification detail to EmployerVerificationService', async () => {
      employerProfileRepo.findOne.mockResolvedValue(baseProfile);

      const result = await service.findOne('profile-1');

      expect(
        verificationService.getVerificationStatusDetail,
      ).toHaveBeenCalledWith('employer-user-1');
      expect(result.verification_status.verified).toBe(true);
    });

    it('returns the empty-state message when no roles have been created', async () => {
      employerProfileRepo.findOne.mockResolvedValue(baseProfile);
      employerRoleRepo.find.mockResolvedValue([]);

      const result = await service.findOne('profile-1');

      expect(result.roles_created.items).toEqual([]);
      expect(result.roles_created.empty_message).toBe('No roles created yet.');
    });

    it('maps role status to display labels', async () => {
      employerProfileRepo.findOne.mockResolvedValue(baseProfile);
      employerRoleRepo.find.mockResolvedValue([
        {
          id: 'role-1',
          title: 'Backend Engineer',
          status: EmployerRoleStatus.ACTIVE,
        },
        {
          id: 'role-2',
          title: 'Frontend Engineer',
          status: EmployerRoleStatus.CLOSED,
        },
      ]);

      const result = await service.findOne('profile-1');

      expect(result.roles_created.items).toEqual([
        { id: 'role-1', title: 'Backend Engineer', status: 'Active' },
        { id: 'role-2', title: 'Frontend Engineer', status: 'Closed' },
      ]);
      expect(result.roles_created.empty_message).toBeNull();
    });

    it('returns the empty-state message when no offers have been sent', async () => {
      employerProfileRepo.findOne.mockResolvedValue(baseProfile);
      offerRepo.find.mockResolvedValue([]);

      const result = await service.findOne('profile-1');

      expect(result.offers_sent.items).toEqual([]);
      expect(result.offers_sent.empty_message).toBe('No offers sent yet.');
    });

    it('filters hire history to accepted interview invites', async () => {
      employerProfileRepo.findOne.mockResolvedValue(baseProfile);
      const hiredAt = new Date('2026-01-01');
      offerRepo.find.mockResolvedValue([
        {
          id: 'offer-1',
          status: OfferStatus.ACCEPTED,
          role_title: 'Backend Engineer',
          candidate: { fullname: 'Tina Talent' },
          responded_at: hiredAt,
        },
        {
          id: 'offer-2',
          status: OfferStatus.PENDING,
          role_title: 'Frontend Engineer',
          candidate: { fullname: 'Other Talent' },
          responded_at: null,
        },
      ]);

      const result = await service.findOne('profile-1');

      expect(result.hire_history.items).toEqual([
        {
          id: 'offer-1',
          candidate_name: 'Tina Talent',
          role_title: 'Backend Engineer',
          hired_at: hiredAt,
        },
      ]);
      expect(result.hire_history.hire_count).toBe(2);
    });
  });
});
