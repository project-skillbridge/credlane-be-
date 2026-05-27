import { Repository } from 'typeorm';
import { AssessmentResult, AssessmentType } from '../assessments/entities';
import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { AiReportService } from './ai-report.service';

type QueryBuilderMock = {
  innerJoin: jest.Mock;
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
    innerJoin: jest.fn().mockReturnThis(),
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
  let assessmentResultRepo: { createQueryBuilder: jest.Mock };

  beforeEach(() => {
    talentProfileRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'profile-1' }),
    };

    skillQb = createQueryBuilderMock({
      guidance_report: { report_type: 'emerging' },
    } as unknown as AssessmentResult);
    advancedQb = createQueryBuilderMock({
      guidance_report: { report_type: 'job_ready' },
    } as unknown as AssessmentResult);

    let qbCall = 0;
    assessmentResultRepo = {
      createQueryBuilder: jest.fn(() => {
        qbCall += 1;
        return qbCall === 1 ? skillQb : advancedQb;
      }),
    };

    service = new AiReportService(
      talentProfileRepo as unknown as Repository<TalentProfile>,
      assessmentResultRepo as unknown as Repository<AssessmentResult>,
    );
  });

  it('returns skill and advanced guidance reports when present', async () => {
    await expect(service.getGuidanceReports('user-1')).resolves.toEqual({
      skill_guidance_report: { report_type: 'emerging' },
      advanced_guidance_report: { report_type: 'job_ready' },
    });

    expect(talentProfileRepo.findOne).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
    });
    expect(assessmentResultRepo.createQueryBuilder).toHaveBeenCalledTimes(2);

    expect(skillQb.where).toHaveBeenCalledWith(
      'attempt.talent_profile_id = :talentProfileId',
      { talentProfileId: 'profile-1' },
    );
    expect(skillQb.andWhere).toHaveBeenCalledWith(
      'attempt.assessment_type = :assessmentType',
      { assessmentType: AssessmentType.SKILL },
    );

    expect(advancedQb.where).toHaveBeenCalledWith(
      'attempt.talent_profile_id = :talentProfileId',
      { talentProfileId: 'profile-1' },
    );
    expect(advancedQb.andWhere).toHaveBeenCalledWith(
      'attempt.assessment_type = :assessmentType',
      { assessmentType: AssessmentType.ADVANCED },
    );
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

    expect(skillQb.andWhere).toHaveBeenCalledWith(
      'attempt.assessment_type = :assessmentType',
      { assessmentType: AssessmentType.SKILL },
    );
    expect(advancedQb.andWhere).toHaveBeenCalledWith(
      'attempt.assessment_type = :assessmentType',
      { assessmentType: AssessmentType.ADVANCED },
    );
  });

  it('returns null when latest results have no guidance_report', async () => {
    const emptyQb = createQueryBuilderMock({
      guidance_report: null,
    } as unknown as AssessmentResult);
    const repo = {
      createQueryBuilder: jest.fn(() => emptyQb),
    };
    service = new AiReportService(
      talentProfileRepo as unknown as Repository<TalentProfile>,
      repo as unknown as Repository<AssessmentResult>,
    );

    await expect(service.getGuidanceReports('user-1')).resolves.toEqual({
      skill_guidance_report: null,
      advanced_guidance_report: null,
    });
  });
});
