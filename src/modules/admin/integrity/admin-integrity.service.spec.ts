import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AssessmentAttempt } from '../../assessments/entities/assessment-attempt.entity';
import {
  AssessmentScore,
  AssessmentScoreQuestionType,
} from '../../assessments/entities/assessment-score.entity';
import { AssessmentType } from '../../assessments/entities/assessment-question.entity';
import { AdminIntegrityService } from './admin-integrity.service';

describe('AdminIntegrityService', () => {
  let service: AdminIntegrityService;

  let attemptGetCount: jest.Mock;
  let attemptGetRawMany: jest.Mock;
  let scoreGetRawOne: jest.Mock;
  let scoreGetMany: jest.Mock;

  function makeChainable(terminal: Record<string, jest.Mock>) {
    const chain: Record<string, jest.Mock> = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      ...terminal,
    };
    return chain;
  }

  beforeEach(async () => {
    attemptGetCount = jest.fn().mockResolvedValue(0);
    attemptGetRawMany = jest.fn().mockResolvedValue([]);
    scoreGetRawOne = jest.fn().mockResolvedValue({ count: '0' });
    scoreGetMany = jest.fn().mockResolvedValue([]);

    const attemptQueryBuilder = makeChainable({
      getCount: attemptGetCount,
      getRawMany: attemptGetRawMany,
    });
    const scoreQueryBuilder = makeChainable({
      getRawOne: scoreGetRawOne,
      getMany: scoreGetMany,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminIntegrityService,
        {
          provide: getRepositoryToken(AssessmentAttempt),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(attemptQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(AssessmentScore),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(scoreQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get(AdminIntegrityService);
  });

  describe('getStats', () => {
    it('returns zeroed stat cards with no trend when there is no data', async () => {
      const result = await service.getStats();

      expect(result.flagged_attempts.value).toBe(0);
      expect(result.voided_attempts.value).toBe(0);
      expect(result.high_confidence_flags.value).toBe(0);
      expect(result.violation_rate_percent.value).toBe(0);
      expect(result.flagged_attempts.trend).toEqual({
        direction: null,
        change_percent: null,
      });
    });

    it('computes violation_rate_percent as flagged/completed', async () => {
      scoreGetRawOne.mockResolvedValue({ count: '5' });
      attemptGetCount.mockResolvedValue(20);

      const result = await service.getStats();

      expect(result.violation_rate_percent.value).toBe(25);
    });

    it('reports an up trend when current exceeds prior', async () => {
      scoreGetRawOne
        .mockResolvedValueOnce({ count: '10' }) // flagged now
        .mockResolvedValueOnce({ count: '5' }); // flagged prior

      const result = await service.getStats();

      expect(result.flagged_attempts.trend.direction).toBe('up');
    });
  });

  describe('findVoidedAttempts', () => {
    it('maps attempt rows with violation summary from flagged scores', async () => {
      attemptGetRawMany.mockResolvedValue([
        {
          a_id: 'attempt-1',
          a_assessment_type: AssessmentType.ADVANCED,
          a_tab_switch_count: 4,
          a_copy_paste_count: 2,
          a_started_at: new Date('2026-01-01T00:00:00Z'),
          a_completed_at: new Date('2026-01-01T00:30:00Z'),
          tp_track: 'frontend_developer',
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
        },
      ]);
      attemptGetCount.mockResolvedValue(1);
      scoreGetMany.mockResolvedValue([
        {
          attempt_id: 'attempt-1',
          integrity_flag: true,
          integrity_confidence: 'medium',
          question_type: AssessmentScoreQuestionType.MCQ,
        },
        {
          attempt_id: 'attempt-1',
          integrity_flag: true,
          integrity_confidence: 'high',
          question_type: AssessmentScoreQuestionType.SHORT_TEXT,
        },
      ]);

      const result = await service.findVoidedAttempts({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({
        id: 'attempt-1',
        talent_name: 'Ada Lovelace',
        talent_email: 'ada@example.com',
        violation_count: 2,
        highest_confidence: 'high',
      });
    });

    it('returns highest_confidence null when there are no flagged scores', async () => {
      attemptGetRawMany.mockResolvedValue([
        {
          a_id: 'attempt-2',
          a_assessment_type: AssessmentType.SKILL,
          a_tab_switch_count: 0,
          a_copy_paste_count: 0,
          a_started_at: new Date('2026-01-01T00:00:00Z'),
          a_completed_at: null,
          tp_track: null,
          first_name: 'Grace',
          last_name: 'Hopper',
          email: 'grace@example.com',
        },
      ]);
      attemptGetCount.mockResolvedValue(1);
      scoreGetMany.mockResolvedValue([]);

      const result = await service.findVoidedAttempts({ page: 1, limit: 20 });

      expect(result.items[0].violation_count).toBe(0);
      expect(result.items[0].highest_confidence).toBeNull();
    });

    it('defaults page and limit when not provided', async () => {
      const result = await service.findVoidedAttempts({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });
});
