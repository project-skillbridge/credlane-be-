import {
  meetsAdvancedQualityBenchmark,
  meetsSkillQualityBenchmark,
  qualifiesForAdvancedFromSkillResult,
} from './assessment-quality';

describe('assessment-quality', () => {
  it('treats scores below 50% as failing the quality benchmark', () => {
    expect(meetsSkillQualityBenchmark(49)).toBe(false);
    expect(meetsAdvancedQualityBenchmark(49)).toBe(false);
    expect(meetsSkillQualityBenchmark(50)).toBe(true);
    expect(meetsAdvancedQualityBenchmark(50)).toBe(true);
  });

  it('requires skill quality and a validated level for advanced unlock', () => {
    expect(
      qualifiesForAdvancedFromSkillResult({
        percentage: 45,
        validated_level: null,
      }),
    ).toBe(false);
    expect(
      qualifiesForAdvancedFromSkillResult({
        percentage: 60,
        validated_level: null,
      }),
    ).toBe(false);
    expect(
      qualifiesForAdvancedFromSkillResult({
        percentage: 55,
        validated_level: 'junior' as never,
      }),
    ).toBe(true);
    expect(
      qualifiesForAdvancedFromSkillResult({
        percentage: 80,
        validated_level: null,
      }),
    ).toBe(false);
    expect(
      qualifiesForAdvancedFromSkillResult({
        percentage: 80,
        validated_level: 'mid' as never,
      }),
    ).toBe(true);
  });
});
