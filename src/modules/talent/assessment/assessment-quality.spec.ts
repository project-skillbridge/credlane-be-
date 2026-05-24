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

  it('requires skill quality and claimed pass for advanced unlock', () => {
    expect(
      qualifiesForAdvancedFromSkillResult({
        percentage: 45,
        claimed_percentage: 80,
      }),
    ).toBe(false);
    expect(
      qualifiesForAdvancedFromSkillResult({
        percentage: 60,
        claimed_percentage: 65,
      }),
    ).toBe(false);
    expect(
      qualifiesForAdvancedFromSkillResult({
        percentage: 55,
        claimed_percentage: 72,
      }),
    ).toBe(true);
    expect(
      qualifiesForAdvancedFromSkillResult({
        percentage: 80,
        claimed_percentage: null,
      }),
    ).toBe(false);
    expect(
      qualifiesForAdvancedFromSkillResult({
        percentage: 80,
      }),
    ).toBe(false);
  });
});
