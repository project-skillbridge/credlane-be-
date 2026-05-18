import { Injectable } from '@nestjs/common';
import { GuidanceReport, GuidanceReportInput } from './ai.types';
import { OpenRouterService } from './openrouter.service';

const SYSTEM_PROMPT = `You are a professional career development advisor providing constructive, actionable feedback to a candidate who did not pass a skills assessment.

Be encouraging but honest. Return ONLY valid JSON — no markdown outside the JSON object.`;

@Injectable()
export class GuidanceReportService {
  constructor(private readonly openRouter: OpenRouterService) {}

  async generate(input: GuidanceReportInput): Promise<GuidanceReport> {
    const userPrompt = `
Track: ${input.track}
Claimed level: ${input.claimed_level}
Validated level: ${input.validated_level}
Score: ${input.percentage}% (pass threshold: 75%)
Strong competencies: ${input.strong_competencies.join(', ') || 'none identified'}
Areas needing improvement: ${input.weak_competencies.join(', ') || 'none identified'}

Generate a personalised guidance report. Return JSON in this exact shape:
{
  "summary": "2-3 sentence overview of their performance",
  "strengths": ["strength 1", "strength 2"],
  "improvement_areas": ["specific area 1", "specific area 2", "specific area 3"],
  "recommended_resources": ["resource or action 1", "resource or action 2"],
  "retake_advice": "one sentence on how to approach the retake in 14 days"
}

Rules:
- Never use the word "failed" or "downgraded"
- Frame everything around growth and next steps
- Be specific to the track and competencies provided
- retake_advice must mention the 14-day window`.trim();

    const raw = await this.openRouter.chat<GuidanceReport>(
      SYSTEM_PROMPT,
      userPrompt,
      0.5,
    );

    return {
      summary: String(raw?.summary ?? ''),
      strengths: Array.isArray(raw?.strengths) ? raw.strengths : [],
      improvement_areas: Array.isArray(raw?.improvement_areas) ? raw.improvement_areas : [],
      recommended_resources: Array.isArray(raw?.recommended_resources) ? raw.recommended_resources : [],
      retake_advice: String(raw?.retake_advice ?? ''),
    };
  }
}
