import { Injectable } from '@nestjs/common';
import { AdvancedAssessmentService } from './advanced-assessment.service';
import type { AdvancedAssessmentSubmitJobData } from './advanced-assessment-submit.types';

@Injectable()
export class AdvancedAssessmentSubmitProcessor {
  constructor(
    private readonly advancedAssessmentService: AdvancedAssessmentService,
  ) {}

  async process(data: AdvancedAssessmentSubmitJobData): Promise<void> {
    await this.advancedAssessmentService.processSubmitJob(data);
  }
}
