import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';
import { AssessmentResult } from '../../assessments/entities';
import { GuidanceReportService } from '../../ai/guidance-report.service';
import type { SkillGuidanceReportJobData } from './skill-guidance-report.types';

@Injectable()
export class SkillGuidanceReportProcessor {
  private readonly logger = new Logger(SkillGuidanceReportProcessor.name);

  constructor(
    @InjectRepository(AssessmentResult)
    private readonly resultRepo: Repository<AssessmentResult>,
    private readonly guidanceReport: GuidanceReportService,
  ) {}

  async process(data: SkillGuidanceReportJobData): Promise<void> {
    try {
      const report = await this.guidanceReport.generate({
        report_type: 'emerging',
        assessment_type: 'skill',
        track: data.track,
        claimed_level: data.claimed_level,
        validated_level: data.validated_level,
        percentage: data.percentage,
        strong_competencies: [],
        weak_competencies: [],
      });

      const result: UpdateResult = await this.resultRepo.update(
        { attempt_id: data.attemptId },
        { guidance_report: { ...report } },
      );

      if ((result.affected ?? 0) === 0) {
        throw new Error(
          `No assessment result row updated for attempt=${data.attemptId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Skill guidance report generation failed for attempt=${data.attemptId}: ${String(error)}`,
      );
      throw error;
    }
  }
}
