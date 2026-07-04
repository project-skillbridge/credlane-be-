import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AssessmentAttempt } from '../../assessments/entities/assessment-attempt.entity';
import { AssessmentType } from '../../assessments/entities/assessment-question.entity';
import { AdminEngagementService } from './admin-engagement.service';

describe('AdminEngagementService', () => {
  let service: AdminEngagementService;
  let mockFind: jest.Mock;

  const nullTrend = { direction: null, change_percent: null };

  beforeEach(async () => {
    mockFind = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminEngagementService,
        {
          provide: getRepositoryToken(AssessmentAttempt),
          useValue: { find: mockFind },
        },
      ],
    }).compile();

    service = module.get(AdminEngagementService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const buildRetakeFixture = () => {
    const now = new Date();
    const user1Attempt1CompletedAt = new Date(
      now.getTime() - 30 * 24 * 3600 * 1000,
    );
    const user1GateClearDate = new Date(
      user1Attempt1CompletedAt.getTime() + 14 * 24 * 3600 * 1000,
    );
    const user1Attempt2StartedAt = new Date(
      user1GateClearDate.getTime() + 2 * 24 * 3600 * 1000,
    );
    const user2Attempt1CompletedAt = new Date(
      now.getTime() - 25 * 24 * 3600 * 1000,
    );
    const user3Attempt1CompletedAt = new Date(
      now.getTime() - 9 * 24 * 3600 * 1000,
    );

    return [
      {
        talent_profile_id: 'user1',
        started_at: new Date(user1Attempt1CompletedAt.getTime() - 3600 * 1000),
        completed_at: user1Attempt1CompletedAt,
        assessment_type: AssessmentType.ADVANCED,
      },
      {
        talent_profile_id: 'user1',
        started_at: user1Attempt2StartedAt,
        completed_at: new Date(user1Attempt2StartedAt.getTime() + 3600 * 1000),
        assessment_type: AssessmentType.ADVANCED,
      },
      {
        talent_profile_id: 'user2',
        started_at: new Date(user2Attempt1CompletedAt.getTime() - 3600 * 1000),
        completed_at: user2Attempt1CompletedAt,
        assessment_type: AssessmentType.ADVANCED,
      },
      {
        talent_profile_id: 'user3',
        started_at: new Date(user3Attempt1CompletedAt.getTime() - 3600 * 1000),
        completed_at: user3Attempt1CompletedAt,
        assessment_type: AssessmentType.ADVANCED,
      },
    ];
  };

  describe('getStats', () => {
    it('returns zeroed cards with null trends when there is no data', async () => {
      mockFind.mockResolvedValue([]);

      const result = await service.getStats();

      expect(result).toEqual({
        minor_assessment_adoption_rate: { value: 0, trend: nullTrend },
        minor_assessment_completion_rate: { value: 0, trend: nullTrend },
        retake_conversion_rate: { value: 0, trend: nullTrend },
        avg_time_to_retake_after_gate_clears_days: {
          value: null,
          trend: nullTrend,
        },
      });
    });

    it('computes retake cards from attempt data with null trends', async () => {
      mockFind.mockResolvedValue(buildRetakeFixture());

      const result = await service.getStats();

      expect(result.retake_conversion_rate).toEqual({
        value: 50,
        trend: nullTrend,
      });
      expect(result.avg_time_to_retake_after_gate_clears_days).toEqual({
        value: 2,
        trend: nullTrend,
      });
      expect(result.minor_assessment_adoption_rate).toEqual({
        value: 0,
        trend: nullTrend,
      });
      expect(result.minor_assessment_completion_rate).toEqual({
        value: 0,
        trend: nullTrend,
      });
    });
  });

  describe('getRetakeDropoff', () => {
    it('returns the empty state when there is not enough retake data', async () => {
      mockFind.mockResolvedValue([]);

      const result = await service.getRetakeDropoff();

      expect(result).toEqual({
        buckets: [],
        empty: true,
        empty_message: 'Not enough retake data yet.',
      });
    });

    it('returns dropoff buckets when enough candidate attempts exist', async () => {
      const baselineAttempts = buildRetakeFixture();
      const repeatedAttempts = Array.from({ length: 10 }, (_, index) => {
        const baseStartedAt = new Date(
          Date.now() - 24 * 60 * 60 * 1000 * (index + 1),
        );
        const firstAttempt = {
          talent_profile_id: `multi-user-${index}`,
          started_at: new Date(
            baseStartedAt.getTime() - 2 * 24 * 60 * 60 * 1000,
          ),
          completed_at: new Date(baseStartedAt.getTime() - 24 * 60 * 60 * 1000),
          assessment_type: AssessmentType.ADVANCED,
        };
        const secondAttempt = {
          talent_profile_id: `multi-user-${index}`,
          started_at: new Date(
            baseStartedAt.getTime() + 2 * 24 * 60 * 60 * 1000,
          ),
          completed_at: new Date(
            baseStartedAt.getTime() + 3 * 24 * 60 * 60 * 1000,
          ),
          assessment_type: AssessmentType.ADVANCED,
        };
        return [firstAttempt, secondAttempt];
      }).flat();
      const attempts = [...baselineAttempts, ...repeatedAttempts];
      mockFind.mockResolvedValue(attempts);

      const result = await service.getRetakeDropoff();

      expect(result.empty).toBe(false);
      expect(result.empty_message).toBeNull();
      expect(result.buckets).toEqual([
        { attempt: 1, retakes: 11 },
        { attempt: 2, retakes: 0 },
        { attempt: 3, retakes: 0 },
      ]);
      expect(result.buckets[0].retakes).toBe(11);
    });
  });

  describe('getMinorUptake', () => {
    it('always returns the stubbed empty state without querying the repo', () => {
      const result = service.getMinorUptake('frontend_developer');

      expect(result).toEqual({
        buckets: [],
        empty: true,
        empty_message: 'No minor assessment data yet.',
      });
      expect(mockFind).not.toHaveBeenCalled();
    });
  });
});
