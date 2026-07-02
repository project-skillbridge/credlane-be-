import { NotFoundException } from '@nestjs/common';
import { AdminTalentsService } from './admin-talents.service';
import { TalentProfileStatus } from '../../talent/entities/talent-profile.entity';
import { AssessmentType } from '../../assessments/entities/assessment-question.entity';
import { AssessmentTier } from '../../assessments/entities/assessment-result.entity';

const buildQueryBuilder = (rawMany: unknown[], count: number) => {
  const qb: Record<string, jest.Mock> = {
    innerJoin: jest.fn(),
    subQuery: jest.fn(),
    select: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
    addSelect: jest.fn(),
    setParameter: jest.fn(),
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

describe('AdminTalentsService', () => {
  describe('findAll', () => {
    it('maps raw rows to the list contract with tier display labels', async () => {
      const rawRows = [
        {
          tp_id: 'talent-1',
          tp_track: 'frontend_developer',
          tp_status: TalentProfileStatus.JOB_READY,
          tp_created_at: new Date('2026-01-01'),
          tp_updated_at: new Date('2026-02-01'),
          first_name: 'Tina',
          last_name: 'Talent',
          email: 'tina@example.com',
          latest_score: '87',
        },
      ];
      const talentProfileRepo = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValue(buildQueryBuilder(rawRows, 1)),
      };

      const service = new AdminTalentsService(
        talentProfileRepo as never,
        {} as never,
        {} as never,
        {} as never,
      );

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items).toEqual([
        {
          id: 'talent-1',
          name: 'Tina Talent',
          email: 'tina@example.com',
          track: 'frontend_developer',
          tier: 'Job Ready',
          latest_stage3_score: 87,
          onboarding_date: rawRows[0].tp_created_at,
          last_activity_date: rawRows[0].tp_updated_at,
        },
      ]);
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    let talentProfileRepo: { findOne: jest.Mock };
    let assessmentAttemptRepo: { find: jest.Mock };
    let assessmentResultRepo: { find: jest.Mock };
    let assessmentScoreRepo: { count: jest.Mock };
    let service: AdminTalentsService;

    const baseProfile = {
      id: 'talent-1',
      user: { fullname: 'Tina Talent', email: 'tina@example.com' },
      track: 'frontend_developer',
      region: 'Nigeria',
      created_at: new Date('2026-01-01'),
      claimed_level: 'mid',
      role_tracks: ['frontend_developer'],
      availability_status: 'actively_looking',
      validated_level: 'mid',
      status: TalentProfileStatus.JOB_READY,
      advanced_retake_required: false,
      assessment_locked_until: null,
      profile_share_link: 'share-token',
    };

    beforeEach(() => {
      talentProfileRepo = { findOne: jest.fn() };
      assessmentAttemptRepo = { find: jest.fn().mockResolvedValue([]) };
      assessmentResultRepo = { find: jest.fn().mockResolvedValue([]) };
      assessmentScoreRepo = { count: jest.fn().mockResolvedValue(0) };

      service = new AdminTalentsService(
        talentProfileRepo as never,
        assessmentAttemptRepo as never,
        assessmentResultRepo as never,
        assessmentScoreRepo as never,
      );
    });

    it('throws NotFoundException when the candidate does not exist', async () => {
      talentProfileRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns a verified profile link only for job-ready candidates', async () => {
      talentProfileRepo.findOne.mockResolvedValue(baseProfile);

      const result = await service.findOne('talent-1');

      expect(result.verified_profile_link).toBe('share-token');
    });

    it('omits the verified profile link for non-job-ready candidates', async () => {
      talentProfileRepo.findOne.mockResolvedValue({
        ...baseProfile,
        status: TalentProfileStatus.EMERGING,
      });

      const result = await service.findOne('talent-1');

      expect(result.verified_profile_link).toBeNull();
    });

    it('computes retakes used from attempt count minus the first attempt', async () => {
      talentProfileRepo.findOne.mockResolvedValue(baseProfile);
      assessmentAttemptRepo.find.mockResolvedValue([
        {
          id: 'a1',
          assessment_type: AssessmentType.SKILL,
          force_submitted: false,
        },
        {
          id: 'a2',
          assessment_type: AssessmentType.SKILL,
          force_submitted: false,
        },
        {
          id: 'a3',
          assessment_type: AssessmentType.SKILL,
          force_submitted: false,
        },
      ]);

      const result = await service.findOne('talent-1');

      expect(result.stage2_result.retakes_used).toBe(2);
      expect(result.subscription_status.free_retakes_remaining).toBe(0);
    });

    it('reports a retake gate only when advanced_retake_required and the lock is still active', async () => {
      const future = new Date(Date.now() + 60_000);
      talentProfileRepo.findOne.mockResolvedValue({
        ...baseProfile,
        advanced_retake_required: true,
        assessment_locked_until: future,
      });

      const result = await service.findOne('talent-1');

      expect(result.stage3_result.retake_gate).toEqual({
        locked_until: future,
      });
    });

    it('reports no retake gate once the lock has expired', async () => {
      const past = new Date(Date.now() - 60_000);
      talentProfileRepo.findOne.mockResolvedValue({
        ...baseProfile,
        advanced_retake_required: true,
        assessment_locked_until: past,
      });

      const result = await service.findOne('talent-1');

      expect(result.stage3_result.retake_gate).toBeNull();
    });

    it('counts voided attempts and integrity violations', async () => {
      talentProfileRepo.findOne.mockResolvedValue(baseProfile);
      assessmentAttemptRepo.find.mockResolvedValue([
        {
          id: 'a1',
          assessment_type: AssessmentType.ADVANCED,
          force_submitted: true,
        },
        {
          id: 'a2',
          assessment_type: AssessmentType.ADVANCED,
          force_submitted: false,
        },
      ]);
      assessmentScoreRepo.count.mockResolvedValue(3);
      assessmentResultRepo.find.mockResolvedValue([
        {
          percentage: 70,
          tier: AssessmentTier.JOB_READY,
          integrity_confidence: 'high',
        },
      ]);

      const result = await service.findOne('talent-1');

      expect(result.integrity_flags.voided_attempts).toBe(1);
      expect(result.integrity_flags.violation_count).toBe(3);
      expect(result.integrity_flags.confidence_level).toBe('high');
    });

    it('returns an empty minor_assessments slot (no entity exists yet)', async () => {
      talentProfileRepo.findOne.mockResolvedValue(baseProfile);

      const result = await service.findOne('talent-1');

      expect(result.minor_assessments).toEqual([]);
    });
  });
});
