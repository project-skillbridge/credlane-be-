import { Global, Module } from '@nestjs/common';
import { GuidanceReportService } from './guidance-report.service';
import { Lt3GenerationService } from './lt3-generation.service';
import { OpenRouterService } from './openrouter.service';
import { QuestionGenerationService } from './question-generation.service';
import { RubricScoringService } from './rubric-scoring.service';

@Global()
@Module({
  providers: [
    OpenRouterService,
    RubricScoringService,
    QuestionGenerationService,
    Lt3GenerationService,
    GuidanceReportService,
  ],
  exports: [
    OpenRouterService,
    RubricScoringService,
    QuestionGenerationService,
    Lt3GenerationService,
    GuidanceReportService,
  ],
})
export class AiModule {}
