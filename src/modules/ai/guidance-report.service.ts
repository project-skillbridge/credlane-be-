import { Injectable, Logger } from '@nestjs/common';
import { GuidanceReport, GuidanceReportInput } from './ai.types';
import { guidanceReportSchema } from './ai.schemas';
import { OpenRouterService } from './openrouter.service';
import { UrlResolutionService } from './url-resolution.service';
import {
  buildGuidanceReportPrompt,
  GUIDANCE_REPORT_SYSTEM_PROMPT,
} from './prompt-builders';

@Injectable()
export class GuidanceReportService {
  private readonly logger = new Logger(GuidanceReportService.name);

  constructor(
    private readonly openRouter: OpenRouterService,
    private readonly urlResolution: UrlResolutionService,
  ) {}

  async generate(input: GuidanceReportInput): Promise<GuidanceReport> {
    const userPrompt = buildGuidanceReportPrompt(input);

    const report = await this.openRouter.chat(
      GUIDANCE_REPORT_SYSTEM_PROMPT,
      userPrompt,
      guidanceReportSchema,
      0.5,
      false,
      undefined,
      'guidance_report',
    );

    // Strip leading ": " or ":" the model sometimes prefixes
    for (const key of ['ai_summary', 'growth_insight', 'summary'] as const) {
      if (report[key]?.startsWith(': ')) {
        report[key] = report[key].slice(2);
      } else if (report[key]?.startsWith(':')) {
        report[key] = report[key].slice(1).trimStart();
      }
    }

    // Resolve resource URLs via Serper
    if (report.recommended_resources.length > 0) {
      this.logger.log(
        `Resolving URLs for ${report.recommended_resources.length} guidance report resources...`,
      );
      const itemsToResolve = report.recommended_resources.map((r) => ({
        ...r,
        description: r.reason,
        type: 'article' as const,
      }));
      const resolved = await this.urlResolution.resolveAllUrls(itemsToResolve);
      report.recommended_resources = resolved.map((r) => ({
        title: r.title,
        provider: r.provider,
        url: r.url,
        tier: r.tier,
        competency: r.competency,
        reason: r.reason,
      }));
    }

    return report;
  }
}
