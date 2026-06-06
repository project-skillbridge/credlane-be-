import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DiscoveryCandidatesQueryDto } from './discovery-candidates-query.dto';

describe('DiscoveryCandidatesQueryDto', () => {
  function toDto(plain: Record<string, unknown>): DiscoveryCandidatesQueryDto {
    return plainToInstance(DiscoveryCandidatesQueryDto, plain);
  }

  describe('tier', () => {
    it('should accept job_ready', async () => {
      const dto = toDto({ tier: 'job_ready' });
      const errors = await validate(dto);
      const tierErrors = errors.filter((e) => e.property === 'tier');
      expect(tierErrors).toHaveLength(0);
    });

    it('should reject emerging', async () => {
      const dto = toDto({ tier: 'emerging' });
      const errors = await validate(dto);
      const tierErrors = errors.filter((e) => e.property === 'tier');
      expect(tierErrors).toHaveLength(1);
      expect(tierErrors[0].constraints?.isIn).toContain('job_ready');
    });

    it('should reject not_ready', async () => {
      const dto = toDto({ tier: 'not_ready' });
      const errors = await validate(dto);
      const tierErrors = errors.filter((e) => e.property === 'tier');
      expect(tierErrors).toHaveLength(1);
    });

    it('should reject arbitrary string', async () => {
      const dto = toDto({ tier: 'invalid_tier' });
      const errors = await validate(dto);
      const tierErrors = errors.filter((e) => e.property === 'tier');
      expect(tierErrors).toHaveLength(1);
    });

    it('should allow omitting tier (optional)', async () => {
      const dto = toDto({});
      const errors = await validate(dto);
      const tierErrors = errors.filter((e) => e.property === 'tier');
      expect(tierErrors).toHaveLength(0);
    });
  });

  describe('availability', () => {
    const validValues = [
      'immediately_available',
      'on_notice_under_1_month',
      'on_notice_1_3_months',
      'employed_flexible',
    ];

    it.each(validValues)('should accept %s', async (value) => {
      const dto = toDto({ availability: value });
      const errors = await validate(dto);
      const availErrors = errors.filter((e) => e.property === 'availability');
      expect(availErrors).toHaveLength(0);
    });

    it('should reject invalid availability value', async () => {
      const dto = toDto({ availability: 'part_time' });
      const errors = await validate(dto);
      const availErrors = errors.filter((e) => e.property === 'availability');
      expect(availErrors).toHaveLength(1);
      expect(availErrors[0].constraints?.isIn).toContain(
        'Invalid availability',
      );
    });

    it('should treat empty string as omitted (no validation error)', async () => {
      const dto = toDto({ availability: '' });
      const errors = await validate(dto);
      const availErrors = errors.filter((e) => e.property === 'availability');
      expect(availErrors).toHaveLength(0);
    });

    it('should allow omitting availability (optional)', async () => {
      const dto = toDto({});
      const errors = await validate(dto);
      const availErrors = errors.filter((e) => e.property === 'availability');
      expect(availErrors).toHaveLength(0);
    });
  });

  describe('roleTrack', () => {
    it('should accept any string', async () => {
      const dto = toDto({ roleTrack: 'frontend_developer' });
      const errors = await validate(dto);
      const trackErrors = errors.filter((e) => e.property === 'roleTrack');
      expect(trackErrors).toHaveLength(0);
    });

    it('should allow omitting roleTrack (optional)', async () => {
      const dto = toDto({});
      const errors = await validate(dto);
      const trackErrors = errors.filter((e) => e.property === 'roleTrack');
      expect(trackErrors).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('should accept a short string', async () => {
      const dto = toDto({ search: 'John' });
      const errors = await validate(dto);
      const searchErrors = errors.filter((e) => e.property === 'search');
      expect(searchErrors).toHaveLength(0);
    });

    it('should reject strings over 100 characters', async () => {
      const dto = toDto({ search: 'a'.repeat(101) });
      const errors = await validate(dto);
      const searchErrors = errors.filter((e) => e.property === 'search');
      expect(searchErrors).toHaveLength(1);
    });

    it('should allow omitting search (optional)', async () => {
      const dto = toDto({});
      const errors = await validate(dto);
      const searchErrors = errors.filter((e) => e.property === 'search');
      expect(searchErrors).toHaveLength(0);
    });
  });

  describe('pagination', () => {
    it('should accept valid page and limit', async () => {
      const dto = toDto({ page: 2, limit: 50 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject page < 1', async () => {
      const dto = toDto({ page: 0 });
      const errors = await validate(dto);
      const pageErrors = errors.filter((e) => e.property === 'page');
      expect(pageErrors).toHaveLength(1);
    });

    it('should reject limit > 100', async () => {
      const dto = toDto({ limit: 101 });
      const errors = await validate(dto);
      const limitErrors = errors.filter((e) => e.property === 'limit');
      expect(limitErrors).toHaveLength(1);
    });
  });
});
