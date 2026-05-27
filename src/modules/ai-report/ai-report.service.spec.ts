import { Repository } from 'typeorm';
import { AssessmentResult, AssessmentType } from '../assessments/entities';
import { TalentProfile } from '../talent/entities/talent-profile.entity';
import { AiReportService } from './ai-report.service';

describe('AiReportService', () => {
  let service: AiReportService;
  let talentProfileRepo: { findOne: jest.Mock };
  let queryBuilder: {
    innerJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    getOne: jest.Mock;
  };
  beforeEach(() => {
    talentProfileRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'profile-1' }),
    };

    const skillQb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        guidance_report: { report_type: 'emerging' },
      }),
    };
    const advancedQb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        guidance_report: { report_type: 'job_ready' },
      }),
    };
    let qbCall = 0;
    queryBuilder = skillQb;

    const assessmentResultRepo = {
      createQueryBuilder: jest.fn(() => {
        qbCall += 1;
        return (qbCall === 1 ? skillQb : advancedQb) as typeof skillQb;
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
  });

  it('returns null reports when talent profile is missing', async () => {
    talentProfileRepo.findOne.mockResolvedValue(null);

    await expect(service.getGuidanceReports('user-1')).resolves.toEqual({
      skill_guidance_report: null,
      advanced_guidance_report: null,
    });
  });

  it('returns null when latest results have no guidance_report', async () => {
    const emptyQb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ guidance_report: null }),
    };
    const assessmentResultRepo = {
      createQueryBuilder: jest.fn(() => emptyQb),
    };
    service = new AiReportService(
      talentProfileRepo as unknown as Repository<TalentProfile>,
      assessmentResultRepo as unknown as Repository<AssessmentResult>,
    );

    await expect(service.getGuidanceReports('user-1')).resolves.toEqual({
      skill_guidance_report: null,
      advanced_guidance_report: null,
    });
  });
});
