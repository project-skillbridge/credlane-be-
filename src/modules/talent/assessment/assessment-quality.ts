import { AssessmentResult } from '../../assessments/entities';
import {
  ADVANCED_ASSESSMENT_QUALITY_MIN_PERCENTAGE,
  SKILL_ASSESSMENT_QUALITY_MIN_PERCENTAGE,
} from '../talent.constants';

export function meetsSkillQualityBenchmark(overallPercentage: number): boolean {
  return overallPercentage >= SKILL_ASSESSMENT_QUALITY_MIN_PERCENTAGE;
}

export function meetsAdvancedQualityBenchmark(
  overallPercentage: number,
): boolean {
  return overallPercentage >= ADVANCED_ASSESSMENT_QUALITY_MIN_PERCENTAGE;
}

export function qualifiesForAdvancedFromSkillResult(
  result: Pick<AssessmentResult, 'percentage' | 'validated_level'>,
): boolean {
  return (
    meetsSkillQualityBenchmark(result.percentage ?? 0) &&
    result.validated_level !== null &&
    result.validated_level !== undefined
  );
}
