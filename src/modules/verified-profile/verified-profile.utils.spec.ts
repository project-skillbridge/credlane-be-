import {
  formatSlugLabel,
  resolveSkills,
  rubricScorePercentage,
} from './verified-profile.utils';

describe('verified-profile.utils', () => {
  it('formats slug labels for display', () => {
    expect(formatSlugLabel('frontend_developer')).toBe('Frontend Developer');
  });

  it('collects tools and other skill entries', () => {
    expect(
      resolveSkills({
        tools: ['react', 'node'],
        tools_other: 'GraphQL',
      }),
    ).toEqual(['react', 'node', 'GraphQL']);
  });

  it('computes rubric percentages and handles edge-case totals', () => {
    expect(rubricScorePercentage({ total: 9 }, false)).toBe(75);
    expect(rubricScorePercentage({ total: 4 }, true)).toBe(67);

    for (const isLt3 of [false, true] as const) {
      expect(rubricScorePercentage({ total: NaN }, isLt3)).toBeNull();
      expect(rubricScorePercentage({ total: Infinity }, isLt3)).toBeNull();
      expect(rubricScorePercentage({ total: undefined }, isLt3)).toBeNull();
      expect(rubricScorePercentage({ total: 'a' }, isLt3)).toBeNull();

      expect(rubricScorePercentage({ total: -1 }, isLt3)).toBe(0);
      expect(rubricScorePercentage({ total: 0 }, isLt3)).toBe(0);
      expect(rubricScorePercentage({ total: 99 }, isLt3)).toBe(100);
    }
  });
});
