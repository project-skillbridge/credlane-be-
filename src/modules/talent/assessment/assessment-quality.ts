import { AssessmentResult } from '../../assessments/entities';
import {
  ADVANCED_ASSESSMENT_QUALITY_MIN_PERCENTAGE,
  SKILL_ASSESSMENT_PASS_PERCENTAGE,
  SKILL_ASSESSMENT_QUALITY_MIN_PERCENTAGE,
} from '../talent.constants';

export function meetsSkillQualityBenchmark(overallPercentage: number): boolean {
  return overallPercentage >= SKILL_ASSESSMENT_QUALITY_MIN_PERCENTAGE;
}

export function meetsAdvancedQualityBenchmark(overallPercentage: number): boolean {
  return overallPercentage >= ADVANCED_ASSESSMENT_QUALITY_MIN_PERCENTAGE;
}

export function qualifiesForAdvancedFromSkillResult(
  result: Pick<AssessmentResult, 'percentage' | 'claimed_percentage'>,
): boolean {
  const percentage = result.percentage ?? 0;
  const claimedPercentage = result.claimed_percentage ?? percentage;

  return (
    meetsSkillQualityBenchmark(percentage) &&
    claimedPercentage >= SKILL_ASSESSMENT_PASS_PERCENTAGE
  );
}
