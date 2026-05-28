import { Injectable } from '@nestjs/common';
import { GuidanceReport, GuidanceReportInput } from './ai.types';
import { guidanceReportSchema } from './ai.schemas';
import { OpenRouterService } from './openrouter.service';
import { SKILL_ASSESSMENT_PASS_PERCENTAGE } from '../talent/talent.constants';

const SYSTEM_PROMPT = `You are a professional career development advisor generating assessment reports for SkillBridge candidates.

Be specific, practical, and role-aware. Return ONLY valid JSON — no markdown outside the JSON object.`;

@Injectable()
export class GuidanceReportService {
  constructor(private readonly openRouter: OpenRouterService) {}

  async generate(input: GuidanceReportInput): Promise<GuidanceReport> {
    const isJobReady = input.report_type === 'job_ready';
    const hasStrongCompetencies = input.strong_competencies.length > 0;
    const hasWeakCompetencies = input.weak_competencies.length > 0;
    const reportFocus = isJobReady
      ? 'Create a strengths-focused Job Ready report. Keep the tone encouraging, growth-oriented, and lighter than a remediation plan.'
      : input.assessment_type === 'skill'
        ? 'Create a targeted improvement plan for an Emerging or Not Ready candidate. Focus on weak areas from the skill assessment and concrete preparation for a retake.'
        : 'Create a targeted improvement plan for an Emerging or Not Ready candidate. Focus on weak areas from the advanced assessment and concrete preparation for a retake.';

    const userPrompt = `
Report type: ${input.report_type}
Track: ${input.track}
Claimed level: ${input.claimed_level}
Validated level: ${input.validated_level}
Score: ${input.percentage}% (Stage 2 quality threshold: ${SKILL_ASSESSMENT_PASS_PERCENTAGE}%)
Strong competencies: ${input.strong_competencies.join(', ') || 'none identified'}
Areas needing improvement: ${input.weak_competencies.join(', ') || 'none identified'}

${reportFocus}

Generate a personalised guidance report. Return JSON in this exact shape:
{
  "report_type": "${input.report_type}",
  "ai_summary": "2 sentences like: You demonstrate strong visual thinking, interface structuring, and product intuition. Your growth opportunities currently lie in communication confidence, systems thinking, and decision-making under ambiguity.",
  "growth_insight": "2 sentences like: Your recent assessments show steady improvement in design thinking, interface structure, and adaptability. Focusing more on communication confidence and systems thinking could significantly improve your overall professional readiness.",
  "summary": "2-3 sentence overview of their performance",
  "strength_ratings": ${
    hasStrongCompetencies
      ? `[
    { "item": "Strong hierarchy, spacing, and interface.", "rating": 3 },
    { "item": "Clear structure and practical reasoning.", "rating": 2 }
  ]`
      : '[]'
  },
  "weak_area_ratings": ${
    hasWeakCompetencies
      ? `[
    { "item": "Needs clearer tradeoff communication.", "rating": 2 },
    { "item": "Improve systems-level reasoning.", "rating": 1 }
  ]`
      : '[]'
  },
  "recommended_resources": [
    {
      "title": "resource title",
      "provider": "provider name",
      "url": "https://example.com/resource",
      "tier": "free",
      "competency": "matched competency",
      "reason": "why this resource fits this candidate"
    }
  ],
  ${isJobReady ? '' : '"retake_advice": "one sentence on how to approach the retake",'}
  "resource_page_url": "/resources"
}

Rules:
- Never use the word "failed" or "downgraded"
- Frame everything around growth and next steps
- Be specific to the track and competencies provided
- recommended_resources must match the track and one of the listed competencies where possible
- recommended_resources must include a mix of free and paid options when possible
- Every resource must have tier exactly "free" or "paid"
- Do not fabricate strengths or weak areas when the corresponding competency list is empty
- If Strong competencies is "none identified", strength_ratings must be []
- If Areas needing improvement is "none identified", weak_area_ratings must be []
- When source competencies are present, the corresponding ratings array must contain 2 to 5 items
- strength_ratings and weak_area_ratings ratings must be integers from 1 to 3
- strength_ratings should usually use ratings 2 or 3
- weak_area_ratings should usually use ratings 1 or 2
- Each rated item must be short, concise, human-readable, and FE-ready
- Each rated item must be a phrase or sentence like "Strong hierarchy, spacing, and interface."
- Do not use snake_case competency labels in rated item text
- ai_summary must sound like a concise product-facing assessment summary, not a remediation note
- growth_insight must describe recent readiness trajectory and the highest-leverage growth focus
- resource_page_url must be "/resources"
${isJobReady ? '- Do not include retake_advice' : input.assessment_type === 'advanced' ? '- retake_advice must mention the 14-day window before retaking the advanced assessment' : '- retake_advice must mention that the candidate has limited attempts remaining on the skill assessment'}`.trim();

    return this.openRouter.chat(
      SYSTEM_PROMPT,
      userPrompt,
      guidanceReportSchema,
      0.5,
    );
  }
}
