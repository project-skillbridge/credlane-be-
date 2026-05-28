import { Repository } from 'typeorm';
import { AssessmentResult, AssessmentType } from '../assessments/entities';
import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { AiReportService } from './ai-report.service';

type QueryBuilderMock = {
  innerJoinAndSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  getOne: jest.Mock;
};

function createQueryBuilderMock(
  getOneResult: AssessmentResult | null,
): QueryBuilderMock {
  return {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(getOneResult),
  };
}

describe('AiReportService', () => {
  let service: AiReportService;
  let talentProfileRepo: { findOne: jest.Mock };
  let skillQb: QueryBuilderMock;
  let advancedQb: QueryBuilderMock;
  let assessmentResultRepo: {
    createQueryBuilder: jest.Mock;
    manager: { findOne: jest.Mock };
  };

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

    let qbCall = 0;
    assessmentResultRepo = {
      createQueryBuilder: jest.fn(() => {
        qbCall += 1;
        return qbCall === 1 ? skillQb : advancedQb;
      }),
      manager: {
        findOne: jest.fn().mockResolvedValue({
          completed_at: new Date('2025-05-20T10:00:00.000Z'),
        }),
      },
    };

    service = new AiReportService(
      talentProfileRepo as unknown as Repository<TalentProfile>,
      assessmentResultRepo as unknown as Repository<AssessmentResult>,
    );
  });

  it('returns skill and advanced guidance reports with score data', async () => {
    const result = await service.getGuidanceReports('user-1');

    expect(result.skill_guidance_report).toEqual({
      score: 72,
      max_score: 100,
      percentage: 72,
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
      max_score: 100,
      percentage: 88,
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
    expect(assessmentResultRepo.createQueryBuilder).toHaveBeenCalledTimes(2);
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
    skillQb.getOne.mockResolvedValue(null);
    advancedQb.getOne.mockResolvedValue(null);

    await expect(service.getGuidanceReports('user-1')).resolves.toEqual({
      skill_guidance_report: null,
      advanced_guidance_report: null,
    });
  });

  it('returns envelope with defaults when guidance_report is null', async () => {
    const emptyQb = createQueryBuilderMock({
      attempt_id: 'attempt-1',
      score: 50,
      max_score: 100,
      percentage: 50,
      guidance_report: null,
    } as unknown as AssessmentResult);
    const repo = {
      createQueryBuilder: jest.fn(() => emptyQb),
      manager: {
        findOne: jest.fn().mockResolvedValue({ completed_at: null }),
      },
    };
    service = new AiReportService(
      talentProfileRepo as unknown as Repository<TalentProfile>,
      repo as unknown as Repository<AssessmentResult>,
    );

    const result = await service.getGuidanceReports('user-1');

    expect(result.skill_guidance_report).toEqual({
      score: 50,
      max_score: 100,
      percentage: 50,
      attempt_date: null,
      report_type: '',
      ai_summary: '',
      summary: '',
      retake_advice: '',
      growth_insight: '',
      strength_ratings: [],
      resource_page_url: '/resources',
      weak_area_ratings: [],
      recommended_resources: [],
    });
  });
});
