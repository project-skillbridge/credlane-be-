import { Repository } from 'typeorm';
import { AssessmentResult, AssessmentType } from '../assessments/entities';
import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { AiReportService } from './ai-report.service';
import { GuidanceReportService } from '../ai/guidance-report.service';

type QueryBuilderMock = {
  innerJoinAndSelect: jest.Mock;
  innerJoin: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  select: jest.Mock;
  addSelect: jest.Mock;
  setParameter: jest.Mock;
  getOne: jest.Mock;
  getRawOne: jest.Mock;
  getRawAndEntities: jest.Mock;
};

function createQueryBuilderMock(
  getOneResult: AssessmentResult | null,
): QueryBuilderMock {
  return {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(getOneResult),
    getRawOne: jest.fn().mockResolvedValue({ total: 10, below: 7 }),
    getRawAndEntities: jest.fn().mockResolvedValue({
      entities: getOneResult ? [getOneResult] : [],
      raw: getOneResult
        ? [{ attempt_completed_at: '2025-05-20T10:00:00.000Z' }]
        : [],
    }),
  };
}

describe('AiReportService', () => {
  let service: AiReportService;
  let talentProfileRepo: { findOne: jest.Mock };
  let skillQb: QueryBuilderMock;
  let advancedQb: QueryBuilderMock;
  let assessmentResultRepo: {
    createQueryBuilder: jest.Mock;
    manager: {
      find: jest.Mock;
      createQueryBuilder: jest.Mock;
      getRepository: jest.Mock;
    };
    update: jest.Mock;
  };
  let guidanceReportGenerator: { generate: jest.Mock };

  beforeEach(() => {
    talentProfileRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'profile-1' }),
    };

    skillQb = createQueryBuilderMock({
      attempt_id: 'attempt-skill-1',
      score: 72,
      max_score: 100,
      percentage: 72,
      guidance_report: {
        report_type: 'emerging',
        ai_summary: 'Good progress',
        summary: 'Overview',
        retake_advice: 'Try again in 14 days',
        growth_insight: 'Keep going',
        strength_ratings: [{ item: 'Logic', rating: 3 }],
        weak_area_ratings: [{ item: 'Communication', rating: 1 }],
        recommended_resources: [],
        resource_page_url: '/resources',
      },
    } as unknown as AssessmentResult);
    advancedQb = createQueryBuilderMock({
      attempt_id: 'attempt-adv-1',
      score: 88,
      max_score: 100,
      percentage: 88,
      guidance_report: {
        report_type: 'job_ready',
        ai_summary: 'Excellent',
        summary: 'Strong performance',
        growth_insight: 'Ready',
        strength_ratings: [{ item: 'Design', rating: 3 }],
        weak_area_ratings: [],
        recommended_resources: [],
        resource_page_url: '/resources',
      },
    } as unknown as AssessmentResult);

    // createQueryBuilder is called 4 times: skill result, advanced result, skill percentile, advanced percentile
    let qbCall = 0;
    assessmentResultRepo = {
      createQueryBuilder: jest.fn(() => {
        qbCall += 1;
        // Calls 1 & 3 are for skill (result then percentile), 2 & 4 for advanced
        if (qbCall === 1) return skillQb;
        if (qbCall === 2) return advancedQb;
        // Percentile queries reuse the same mock shape
        return createQueryBuilderMock(null);
      }),
      manager: {
        find: jest.fn().mockResolvedValue([]),
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        }),
        getRepository: jest.fn().mockReturnValue({
          find: jest.fn().mockResolvedValue([]),
        }),
      },
      update: jest.fn().mockResolvedValue(undefined),
    };

    guidanceReportGenerator = {
      generate: jest.fn().mockResolvedValue({
        report_type: 'emerging',
        ai_summary: 'Generated',
        summary: 'Generated summary',
        retake_advice: '',
        growth_insight: 'Growth',
        strength_ratings: [],
        weak_area_ratings: [],
        recommended_resources: [],
        resource_page_url: '/resources',
      }),
    };

    service = new AiReportService(
      talentProfileRepo as unknown as Repository<TalentProfile>,
      assessmentResultRepo as unknown as Repository<AssessmentResult>,
      guidanceReportGenerator as unknown as GuidanceReportService,
    );
  });

  it('returns skill and advanced guidance reports with percentile', async () => {
    const result = await service.getGuidanceReports('user-1');

    expect(result.skill_guidance_report).toEqual({
      score: 72,
      percentile: 70,
      attempt_date: '2025-05-20T10:00:00.000Z',
      report_type: 'emerging',
      ai_summary: 'Good progress',
      summary: 'Overview',
      retake_advice: 'Try again in 14 days',
      growth_insight: 'Keep going',
      strength_ratings: [{ item: 'Logic', rating: 3 }],
      resource_page_url: '/resources',
      weak_area_ratings: [{ item: 'Communication', rating: 1 }],
      recommended_resources: [],
    });

    expect(result.advanced_guidance_report).toEqual({
      score: 88,
      percentile: 70,
      attempt_date: '2025-05-20T10:00:00.000Z',
      report_type: 'job_ready',
      ai_summary: 'Excellent',
      summary: 'Strong performance',
      retake_advice: '',
      growth_insight: 'Ready',
      strength_ratings: [{ item: 'Design', rating: 3 }],
      resource_page_url: '/resources',
      weak_area_ratings: [],
      recommended_resources: [],
    });

    expect(talentProfileRepo.findOne).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
    });
    // 2 for getLatestResult + 2 for calculatePercentile
    expect(assessmentResultRepo.createQueryBuilder).toHaveBeenCalledTimes(4);
  });

  it('returns null reports when talent profile is missing', async () => {
    talentProfileRepo.findOne.mockResolvedValue(null);

    await expect(service.getGuidanceReports('user-1')).resolves.toEqual({
      skill_guidance_report: null,
      advanced_guidance_report: null,
    });

    expect(assessmentResultRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('returns null when getOne finds no assessment results', async () => {
    skillQb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });
    advancedQb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });

    await expect(service.getGuidanceReports('user-1')).resolves.toEqual({
      skill_guidance_report: null,
      advanced_guidance_report: null,
    });
  });

  it('generates guidance report on demand when guidance_report is null', async () => {
    const resultData = {
      id: 'result-1',
      attempt_id: 'attempt-1',
      score: 50,
      max_score: 100,
      percentage: 50,
      tier: 'emerging',
      guidance_report: null,
    } as unknown as AssessmentResult;
    const emptyQb = createQueryBuilderMock(resultData);
    emptyQb.getRawAndEntities.mockResolvedValue({
      entities: [resultData],
      raw: [{ attempt_completed_at: null }],
    });
    // Skill result returns null (no result), advanced returns the one with null guidance_report
    const nullQb = createQueryBuilderMock(null);
    nullQb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });
    let call = 0;
    const repo = {
      createQueryBuilder: jest.fn(() => {
        call += 1;
        // call 1 = skill result (null), call 2 = advanced result (emptyQb)
        // call 3+ = percentile queries
        if (call === 1) return nullQb;
        if (call === 2) return emptyQb;
        return createQueryBuilderMock(null);
      }),
      manager: {
        find: jest.fn().mockResolvedValue([]),
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        }),
        getRepository: jest.fn().mockReturnValue({
          find: jest.fn().mockResolvedValue([]),
        }),
      },
      update: jest.fn().mockResolvedValue(undefined),
    };
    service = new AiReportService(
      talentProfileRepo as unknown as Repository<TalentProfile>,
      repo as unknown as Repository<AssessmentResult>,
      guidanceReportGenerator as unknown as GuidanceReportService,
    );

    const result = await service.getGuidanceReports('user-1');

    expect(guidanceReportGenerator.generate).toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(
      'result-1',
      expect.objectContaining({
        guidance_report: expect.any(Object),
      }),
    );
    expect(result.advanced_guidance_report).toEqual({
      score: 50,
      percentile: 70,
      attempt_date: null,
      report_type: 'emerging',
      ai_summary: 'Generated',
      summary: 'Generated summary',
      retake_advice: '',
      growth_insight: 'Growth',
      strength_ratings: [],
      resource_page_url: '/resources',
      weak_area_ratings: [],
      recommended_resources: [],
    });
  });

  it('returns 0 percentile when no other results exist', async () => {
    const resultQb = createQueryBuilderMock({
      attempt_id: 'attempt-1',
      score: 80,
      max_score: 100,
      percentage: 80,
      guidance_report: { report_type: 'job_ready' },
    } as unknown as AssessmentResult);
    const percentileQb = createQueryBuilderMock(null);
    percentileQb.getRawOne.mockResolvedValue({ total: 0, below: 0 });

    let call = 0;
    const repo = {
      createQueryBuilder: jest.fn(() => {
        call += 1;
        return call <= 2 ? resultQb : percentileQb;
      }),
      manager: {
        findOne: jest.fn().mockResolvedValue({
          completed_at: new Date('2025-06-01T00:00:00.000Z'),
        }),
      },
    };
    service = new AiReportService(
      talentProfileRepo as unknown as Repository<TalentProfile>,
      repo as unknown as Repository<AssessmentResult>,
      guidanceReportGenerator as unknown as GuidanceReportService,
    );

    const result = await service.getGuidanceReports('user-1');
    expect(result.skill_guidance_report?.percentile).toBe(0);
  });
});
