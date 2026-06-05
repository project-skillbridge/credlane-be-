import { EmployerVerificationService } from './employer-verification.service';
import { EmployerProfile } from './entities/employer-profile.entity';

describe('EmployerVerificationService', () => {
  let service: EmployerVerificationService;
  let employerProfileRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let userRepo: { findOne: jest.Mock };

  const userId = 'user-uuid-1';

  beforeEach(() => {
    employerProfileRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    userRepo = { findOne: jest.fn() };

    service = new EmployerVerificationService(
      employerProfileRepo as never,
      userRepo as never,
    );
  });

  function mockUser(
    overrides: Partial<{ id: string; is_verified: boolean }> = {},
  ) {
    return { id: userId, is_verified: true, ...overrides };
  }

  function mockProfile(
    overrides: Partial<EmployerProfile> = {},
  ): Partial<EmployerProfile> {
    return {
      user_id: userId,
      company_website: 'https://acme.example',
      linkedin_company_page_url: 'https://linkedin.com/company/acme',
      is_verified: false,
      ...overrides,
    };
  }

  describe('checkAndUpdateVerification', () => {
    beforeEach(() => {
      jest.spyOn(service, 'isWebsiteResolvable').mockResolvedValue(true);
    });

    it('returns true when all criteria are met', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      employerProfileRepo.findOne.mockResolvedValue(mockProfile());

      const result = await service.checkAndUpdateVerification(userId);

      expect(result).toBe(true);
      expect(employerProfileRepo.update).toHaveBeenCalledWith(
        { user_id: userId },
        { is_verified: true },
      );
    });

    it('returns false when email is not verified', async () => {
      userRepo.findOne.mockResolvedValue(mockUser({ is_verified: false }));
      employerProfileRepo.findOne.mockResolvedValue(mockProfile());

      const result = await service.checkAndUpdateVerification(userId);

      expect(result).toBe(false);
    });

    it('returns false when LinkedIn URL is missing', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      employerProfileRepo.findOne.mockResolvedValue(
        mockProfile({ linkedin_company_page_url: null }),
      );

      const result = await service.checkAndUpdateVerification(userId);

      expect(result).toBe(false);
    });

    it('returns false when website is not resolvable', async () => {
      jest.spyOn(service, 'isWebsiteResolvable').mockResolvedValue(false);
      userRepo.findOne.mockResolvedValue(mockUser());
      employerProfileRepo.findOne.mockResolvedValue(mockProfile());

      const result = await service.checkAndUpdateVerification(userId);

      expect(result).toBe(false);
    });

    it('does not update if verification status is unchanged', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      employerProfileRepo.findOne.mockResolvedValue(
        mockProfile({ is_verified: true }),
      );

      await service.checkAndUpdateVerification(userId);

      expect(employerProfileRepo.update).not.toHaveBeenCalled();
    });

    it('revokes verification when criteria are no longer met', async () => {
      jest.spyOn(service, 'isWebsiteResolvable').mockResolvedValue(false);
      userRepo.findOne.mockResolvedValue(mockUser());
      employerProfileRepo.findOne.mockResolvedValue(
        mockProfile({ is_verified: true }),
      );

      const result = await service.checkAndUpdateVerification(userId);

      expect(result).toBe(false);
      expect(employerProfileRepo.update).toHaveBeenCalledWith(
        { user_id: userId },
        { is_verified: false },
      );
    });

    it('returns false when user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.checkAndUpdateVerification(userId);

      expect(result).toBe(false);
    });

    it('returns false when profile is not found', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      employerProfileRepo.findOne.mockResolvedValue(null);

      const result = await service.checkAndUpdateVerification(userId);

      expect(result).toBe(false);
    });

    it('uses website_url as fallback when company_website is null', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      employerProfileRepo.findOne.mockResolvedValue(
        mockProfile({
          company_website: null,
          website_url: 'https://fallback.example',
        }),
      );

      await service.checkAndUpdateVerification(userId);

      expect(service.isWebsiteResolvable).toHaveBeenCalledWith(
        'https://fallback.example',
      );
    });
  });

  describe('getVerificationStatus', () => {
    it('returns true when profile is verified', async () => {
      employerProfileRepo.findOne.mockResolvedValue(
        mockProfile({ is_verified: true }),
      );

      expect(await service.getVerificationStatus(userId)).toBe(true);
    });

    it('returns false when profile is not verified', async () => {
      employerProfileRepo.findOne.mockResolvedValue(
        mockProfile({ is_verified: false }),
      );

      expect(await service.getVerificationStatus(userId)).toBe(false);
    });

    it('returns false when profile does not exist', async () => {
      employerProfileRepo.findOne.mockResolvedValue(null);

      expect(await service.getVerificationStatus(userId)).toBe(false);
    });
  });

  describe('isWebsiteResolvable', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
      jest.restoreAllMocks();
      // Mock dns.resolve4/resolve6 to return a public IP by default
      jest
        .spyOn(require('dns/promises'), 'resolve4')
        .mockResolvedValue(['93.184.216.34']);
      jest.spyOn(require('dns/promises'), 'resolve6').mockResolvedValue([]);
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('returns true for a successful HEAD response', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: true, status: 200, headers: new Map() });

      expect(await service.isWebsiteResolvable('https://acme.example')).toBe(
        true,
      );
    });

    it('returns false for null/empty URL', async () => {
      expect(await service.isWebsiteResolvable(null)).toBe(false);
      expect(await service.isWebsiteResolvable('')).toBe(false);
    });

    it('prepends https:// when missing', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: true, status: 200, headers: new Map() });

      await service.isWebsiteResolvable('acme.example');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://acme.example',
        expect.objectContaining({ method: 'HEAD' }),
      );
    });

    it('falls back to GET on 405', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 405, headers: new Map() })
        .mockResolvedValueOnce({ ok: true, status: 200, headers: new Map() });

      const result = await service.isWebsiteResolvable('https://acme.example');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('returns false on network error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      expect(await service.isWebsiteResolvable('https://acme.example')).toBe(
        false,
      );
    });

    it('returns false for non-ok response', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: false, status: 500, headers: new Map() });

      expect(await service.isWebsiteResolvable('https://acme.example')).toBe(
        false,
      );
    });

    it('returns false for private/internal IPs (SSRF protection)', async () => {
      const dnsResolve4 = require('dns/promises').resolve4;
      dnsResolve4.mockResolvedValue(['127.0.0.1']);
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

      expect(await service.isWebsiteResolvable('https://evil.example')).toBe(
        false,
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns false for IP-literal private hosts', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

      expect(await service.isWebsiteResolvable('https://192.168.1.1')).toBe(
        false,
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns false for non-standard ports', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

      expect(
        await service.isWebsiteResolvable('https://acme.example:8080'),
      ).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('stops at MAX_REDIRECTS when redirect chain is too long', async () => {
      const redirectResponse = {
        ok: false,
        status: 302,
        headers: new Map([['location', 'https://acme.example/next']]),
      };
      global.fetch = jest.fn().mockResolvedValue(redirectResponse);

      const result = await service.isWebsiteResolvable('https://acme.example');

      expect(result).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('getVerificationStatusDetail', () => {
    beforeEach(() => {
      jest.spyOn(service, 'isWebsiteResolvable').mockResolvedValue(true);
    });

    it('returns structured criteria and banner visibility', async () => {
      userRepo.findOne.mockResolvedValue(mockUser({ is_verified: true }));
      employerProfileRepo.findOne.mockResolvedValue(mockProfile());

      const result = await service.getVerificationStatusDetail(userId);

      expect(result).toEqual({
        verified: true,
        criteria: {
          email_verified: true,
          website_resolvable: true,
          linkedin_provided: true,
        },
        banner_visible: false,
      });
    });

    it('shows banner when verification criteria are incomplete', async () => {
      userRepo.findOne.mockResolvedValue(mockUser({ is_verified: false }));
      employerProfileRepo.findOne.mockResolvedValue(
        mockProfile({
          linkedin_company_page_url: null,
          linkedin_company_url: null,
        }),
      );
      jest.spyOn(service, 'isWebsiteResolvable').mockResolvedValue(false);

      const result = await service.getVerificationStatusDetail(userId);

      expect(result.verified).toBe(false);
      expect(result.banner_visible).toBe(true);
      expect(result.criteria.linkedin_provided).toBe(false);
      expect(result.criteria.website_resolvable).toBe(false);
    });
  });
});
