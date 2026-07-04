import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AssessmentAttempt } from '../../assessments/entities/assessment-attempt.entity';
import { AdminEngagementService } from './admin-engagement.service';

describe('AdminEngagementService', () => {
  let service: AdminEngagementService;
  let mockQuery: jest.Mock;

  beforeEach(async () => {
    mockQuery = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminEngagementService,
        {
          provide: getRepositoryToken(AssessmentAttempt),
          useValue: { query: mockQuery },
        },
      ],
    }).compile();

    service = module.get(AdminEngagementService);
  });

  describe('getStats', () => {
    it('returns stubbed zero values for minor assessment stats when there is no data', async () => {
      mockQuery.mockResolvedValue([{ total: '0', retakers: '0', avg_days: null }]);

      const result = await service.getStats();

      expect(result.minor_assessment_adoption_rate.value).toBe(0);
      expect(result.minor_assessment_adoption_rate.trend.direction).toBeNull();
      expect(result.minor_assessment_completion_rate.value).toBe(0);
    });

    it('computes retake_conversion_rate correctly', async () => {
      mockQuery
        .mockResolvedValueOnce([{ total: '10', retakers: '4' }]) // now
        .mockResolvedValueOnce([{ total: '8', retakers: '2' }]) // prior
        .mockResolvedValueOnce([{ avg_days: null }]) // avg now
        .mockResolvedValueOnce([{ avg_days: null }]); // avg prior

      const result = await service.getStats();

      expect(result.retake_conversion_rate.value).toBe(40);
    });

    it('returns null trend for avg_time_to_retake when data is insufficient', async () => {
      mockQuery.mockResolvedValue([{ total: '0', retakers: '0', avg_days: null }]);

      const result = await service.getStats();

      expect(result.avg_time_to_retake_days.trend.direction).toBeNull();
      expect(result.avg_time_to_retake_days.trend.change_percent).toBeNull();
    });
  });

  describe('getRetakeDropoff', () => {
    it('returns empty state when fewer than 10 candidates have attempts', async () => {
      mockQuery.mockResolvedValue([{ attempt_number: '1', count: '5' }]);

      const result = await service.getRetakeDropoff();

      expect(result.empty).toBe(true);
      expect(result.empty_message).toBe('Not enough retake data yet.');
      expect(result.buckets).toEqual([]);
    });

    it('returns bucket counts when ≥10 candidates have attempts', async () => {
      mockQuery.mockResolvedValue([
        { attempt_number: '1', count: '15' },
        { attempt_number: '2', count: '8' },
        { attempt_number: '3', count: '3' },
      ]);

      const result = await service.getRetakeDropoff();

      expect(result.empty).toBe(false);
      expect(result.buckets).toEqual([
        { attempt_number: 1, count: 15 },
        { attempt_number: 2, count: 8 },
        { attempt_number: 3, count: 3 },
      ]);
      expect(result.total_candidates_with_attempts).toBe(15);
    });
  });

  describe('getMinorUptake', () => {
    it('always returns empty stub regardless of track param', () => {
      const result = service.getMinorUptake('frontend_developer');

      expect(result.empty).toBe(true);
      expect(result.empty_message).toBe('No minor assessment data yet.');
      expect(result.buckets).toEqual([]);
    });

    it('returns empty stub when no track is provided', () => {
      const result = service.getMinorUptake();

      expect(result.empty).toBe(true);
    });
  });
});
