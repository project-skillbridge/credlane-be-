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

  it('computes rubric percentages', () => {
    expect(rubricScorePercentage({ total: 9 }, false)).toBe(75);
    expect(rubricScorePercentage({ total: 4 }, true)).toBe(67);
  });
});
