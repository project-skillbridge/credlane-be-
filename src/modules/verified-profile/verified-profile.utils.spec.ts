import {
  buildQrCodeUrl,
  buildShareUrl,
  categorizeCompetencies,
  compactStrings,
  formatSlugLabel,
  readPersonalAnswers,
  readSessionQuestions,
  resolveAvailabilityLabel,
  resolveExperienceLabel,
  resolveGoalLabel,
  resolveJobSearchStatusLabel,
  resolveKeyStrengths,
  resolveRoleLabel,
  resolveSeniorityBadge,
  resolveSkills,
  resolveTierLabel,
  resolveWorkArrangementLabels,
  rubricScorePercentage,
} from './verified-profile.utils';

describe('verified-profile.utils', () => {
  describe('formatSlugLabel', () => {
    it('formats slug labels for display', () => {
      expect(formatSlugLabel('frontend_developer')).toBe('Frontend Developer');
      expect(formatSlugLabel('')).toBe('');
      expect(formatSlugLabel('single')).toBe('Single');
      expect(formatSlugLabel('already Formatted')).toBe('Already Formatted');
    });
  });

  describe('compactStrings', () => {
    it('removes empty strings and case-insensitive duplicates', () => {
      expect(
        compactStrings([' Mid Level ', '', undefined, 'mid level', 'Remote']),
      ).toEqual(['Mid Level', 'Remote']);
    });
  });

  describe('readPersonalAnswers', () => {
    it('strips _meta key from answers', () => {
      const result = readPersonalAnswers({
        tools: ['react'],
        specialization: 'frontend',
        _meta: { version: 1 },
      });
      expect(result).toEqual({ tools: ['react'], specialization: 'frontend' });
      expect('_meta' in result).toBe(false);
    });

    it('returns empty object for null', () => {
      expect(readPersonalAnswers(null)).toEqual({});
    });

    it('returns empty object for non-object types', () => {
      expect(readPersonalAnswers('string' as never)).toEqual({});
      expect(readPersonalAnswers(123 as never)).toEqual({});
      expect(
        readPersonalAnswers([] as unknown as Record<string, unknown>),
      ).toEqual({});
    });
  });

  describe('resolveSkills', () => {
    it('collects tools and other skill entries', () => {
      expect(
        resolveSkills({
          tools: ['react', 'node'],
          tools_other: 'GraphQL',
        }),
      ).toEqual(['react', 'node', 'GraphQL']);
    });

    it('filters out empty strings from tools', () => {
      expect(
        resolveSkills({
          tools: ['react', '', '  '],
        }),
      ).toEqual(['react']);
    });

    it('returns undefined when no tools found', () => {
      expect(resolveSkills({})).toBeUndefined();
      expect(resolveSkills({ tools: [] })).toBeUndefined();
      expect(resolveSkills(null)).toBeUndefined();
      expect(resolveSkills(undefined)).toBeUndefined();
    });

    it('ignores non-string entries in tools array', () => {
      expect(
        resolveSkills({
          tools: ['react', 123, null, 'node'],
        }),
      ).toEqual(['react', 'node']);
    });
  });

  describe('resolveRoleLabel', () => {
    it('prioritizes the saved profile track over stale personal-answer specialization', () => {
      expect(
        resolveRoleLabel('backend_developer', null, null, {
          specialization: 'frontend_engineer',
        }),
      ).toBe('Backend Developer');
    });

    it('prioritizes the saved profile track over pool profile specialization', () => {
      expect(
        resolveRoleLabel('backend_developer', null, 'api_engineering', {
          specialization: 'frontend_engineer',
        }),
      ).toBe('Backend Developer');
    });

    it('falls back to profileTrack', () => {
      expect(resolveRoleLabel('data_analyst', null, null, {})).toBe(
        'Data Analyst',
      );
    });

    it('falls back to profileRoleTrack', () => {
      expect(resolveRoleLabel(null, 'product_designer', null, {})).toBe(
        'Product Designer',
      );
    });

    it('uses specialization only when no saved track exists', () => {
      expect(
        resolveRoleLabel(null, null, 'api_engineering', {
          specialization: 'frontend_engineer',
        }),
      ).toBe('Api Engineering');
      expect(
        resolveRoleLabel(null, null, null, {
          specialization: 'frontend_engineer',
        }),
      ).toBe('Frontend Engineer');
    });

    it('returns Talent as last resort', () => {
      expect(resolveRoleLabel(null, null, null, {})).toBe('Talent');
    });
  });

  describe('resolveGoalLabel', () => {
    it('formats goal slug', () => {
      expect(resolveGoalLabel('land_first_role')).toBe('Land First Role');
    });

    it('returns empty string for null or empty', () => {
      expect(resolveGoalLabel(null)).toBe('');
      expect(resolveGoalLabel('')).toBe('');
    });
  });

  describe('verified report label helpers', () => {
    it('formats experience labels', () => {
      expect(resolveExperienceLabel('3_5_yrs')).toBe('3-5 yrs exp.');
      expect(resolveExperienceLabel('custom_value')).toBe('Custom Value');
      expect(resolveExperienceLabel(null)).toBeUndefined();
    });

    it('formats availability labels', () => {
      expect(resolveAvailabilityLabel('immediately_available')).toBe(
        'Immediately Available',
      );
      expect(resolveAvailabilityLabel('employed_flexible')).toBe(
        'Employed, Flexible',
      );
      expect(resolveAvailabilityLabel(null)).toBeUndefined();
    });

    it('formats job search status labels', () => {
      expect(resolveJobSearchStatusLabel('open_to_right_opportunity')).toBe(
        'Open to Work',
      );
      expect(resolveJobSearchStatusLabel('actively_looking')).toBe(
        'Actively Looking',
      );
      expect(resolveJobSearchStatusLabel(null)).toBeUndefined();
    });

    it('formats work arrangement labels', () => {
      expect(
        resolveWorkArrangementLabels(['fully_remote', 'hybrid', 'hybrid']),
      ).toEqual(['Fully Remote', 'Hybrid']);
      expect(resolveWorkArrangementLabels('open_to_any')).toEqual([
        'Open to Any',
      ]);
      expect(resolveWorkArrangementLabels(null)).toEqual([]);
    });
  });

  describe('readSessionQuestions', () => {
    it('returns questions array from generated_questions_json', () => {
      const json = {
        questions: [
          { question_id: 'q1', block: 'short_text' },
          { question_id: 'q2', block: 'long_text' },
        ],
      };
      expect(readSessionQuestions(json)).toHaveLength(2);
    });

    it('returns empty array for null', () => {
      expect(readSessionQuestions(null)).toEqual([]);
    });

    it('returns empty array for malformed data', () => {
      expect(readSessionQuestions({})).toEqual([]);
      expect(readSessionQuestions({ questions: 'not-array' })).toEqual([]);
      expect(readSessionQuestions({ questions: null })).toEqual([]);
      expect(
        readSessionQuestions([] as unknown as Record<string, unknown>),
      ).toEqual([]);
      expect(readSessionQuestions('string' as never)).toEqual([]);
    });
  });

  describe('rubricScorePercentage', () => {
    it('computes standard rubric scores', () => {
      expect(rubricScorePercentage({ total: 9 }, false)).toBe(75);
      expect(rubricScorePercentage({ total: 4 }, true)).toBe(67);
    });

    it('handles edge-case totals', () => {
      for (const isLt3 of [false, true] as const) {
        expect(rubricScorePercentage({ total: NaN }, isLt3)).toBeNull();
        expect(rubricScorePercentage({ total: Infinity }, isLt3)).toBeNull();
        expect(rubricScorePercentage({ total: undefined }, isLt3)).toBeNull();
        expect(rubricScorePercentage({ total: 'a' }, isLt3)).toBeNull();
        expect(rubricScorePercentage({ total: null }, isLt3)).toBeNull();

        expect(rubricScorePercentage({ total: -1 }, isLt3)).toBe(0);
        expect(rubricScorePercentage({ total: 0 }, isLt3)).toBe(0);
        expect(rubricScorePercentage({ total: 99 }, isLt3)).toBe(100);
      }
    });

    it('returns null for null evaluation', () => {
      expect(rubricScorePercentage(null, false)).toBeNull();
      expect(rubricScorePercentage(null, true)).toBeNull();
    });
  });

  describe('resolveSeniorityBadge', () => {
    it('returns correct label for each verified level', () => {
      expect(resolveSeniorityBadge('entry')).toBe('Entry Level');
      expect(resolveSeniorityBadge('junior')).toBe('Junior Level');
      expect(resolveSeniorityBadge('mid')).toBe('Mid Level');
      expect(resolveSeniorityBadge('senior')).toBe('Senior Level');
      expect(resolveSeniorityBadge('expert')).toBe('Expert Level');
    });

    it('returns formatted label for unknown level', () => {
      expect(resolveSeniorityBadge('principal')).toBe('Principal');
    });

    it('returns undefined for null or undefined', () => {
      expect(resolveSeniorityBadge(null)).toBeUndefined();
      expect(resolveSeniorityBadge(undefined)).toBeUndefined();
    });
  });

  describe('resolveTierLabel', () => {
    it('returns correct display labels', () => {
      expect(resolveTierLabel('job_ready')).toBe('Job Ready');
      expect(resolveTierLabel('emerging')).toBe('Emerging');
      expect(resolveTierLabel('not_ready')).toBe('Not Ready');
    });

    it('returns formatted label for unknown tier', () => {
      expect(resolveTierLabel('unknown_tier')).toBe('Unknown Tier');
    });

    it('returns undefined for null or undefined', () => {
      expect(resolveTierLabel(null)).toBeUndefined();
      expect(resolveTierLabel(undefined)).toBeUndefined();
    });
  });

  describe('resolveKeyStrengths', () => {
    const scores = {
      technical_reasoning: 92,
      communication: 78,
      leadership: 65,
    };

    it('returns sorted strengths matching strong competencies', () => {
      const result = resolveKeyStrengths(scores, [
        'technical_reasoning',
        'leadership',
      ]);
      expect(result).toHaveLength(2);
      expect(result![0].competency).toBe('technical_reasoning');
      expect(result![0].percentage).toBe(92);
      expect(result![1].competency).toBe('leadership');
      expect(result![1].percentage).toBe(65);
    });

    it('is case-insensitive when matching competencies', () => {
      const result = resolveKeyStrengths(scores, ['Technical_Reasoning']);
      expect(result).toHaveLength(1);
      expect(result![0].competency).toBe('technical_reasoning');
    });

    it('returns undefined when competencyScores is null', () => {
      expect(resolveKeyStrengths(null, ['test'])).toBeUndefined();
    });

    it('returns undefined when strongCompetencies is empty', () => {
      expect(resolveKeyStrengths(scores, [])).toBeUndefined();
    });

    it('returns undefined when strongCompetencies is null', () => {
      expect(resolveKeyStrengths(scores, null)).toBeUndefined();
    });

    it('returns undefined when no competencies match', () => {
      expect(
        resolveKeyStrengths(scores, ['nonexistent_competency']),
      ).toBeUndefined();
    });
  });

  describe('categorizeCompetencies', () => {
    it('splits professional and soft competencies', () => {
      const scores = {
        technical_reasoning: 92,
        communication: 78,
        leadership: 85,
        problem_solving: 88,
      };

      const result = categorizeCompetencies(scores);
      expect(result.professionalSkills).toBeDefined();
      expect(result.softSkills).toBeDefined();

      const profLabels = result.professionalSkills!.map((s) => s.label);
      expect(profLabels).toContain('Technical Reasoning');
      expect(profLabels).toContain('Problem Solving');

      const softLabels = result.softSkills!.map((s) => s.label);
      expect(softLabels).toContain('Communication');
      expect(softLabels).toContain('Leadership');
    });

    it('puts unknown competencies in professional by default', () => {
      const result = categorizeCompetencies({
        some_unknown_skill: 75,
      });
      expect(result.professionalSkills).toHaveLength(1);
      expect(result.professionalSkills![0].label).toBe('Some Unknown Skill');
      expect(result.softSkills).toBeUndefined();
    });

    it('returns undefined for both when scores is null', () => {
      const result = categorizeCompetencies(null);
      expect(result.professionalSkills).toBeUndefined();
      expect(result.softSkills).toBeUndefined();
    });

    it('sorts by percentage descending', () => {
      const result = categorizeCompetencies({
        technical_reasoning: 80,
        problem_solving: 95,
      });
      expect(result.professionalSkills![0].percentage).toBe(95);
      expect(result.professionalSkills![1].percentage).toBe(80);
    });
  });

  describe('buildShareUrl', () => {
    it('constructs correct share URL', () => {
      expect(buildShareUrl('https://skillbridge.com', 'abc123')).toBe(
        'https://skillbridge.com/verified-profiles/abc123',
      );
    });

    it('strips trailing slashes from base URL', () => {
      expect(buildShareUrl('https://skillbridge.com/', 'abc123')).toBe(
        'https://skillbridge.com/verified-profiles/abc123',
      );
    });

    it('returns empty string when token is missing', () => {
      expect(buildShareUrl('https://skillbridge.com', null)).toBe('');
      expect(buildShareUrl('https://skillbridge.com', undefined)).toBe('');
    });
  });

  describe('buildQrCodeUrl', () => {
    it('constructs QR code URL with encoded data', () => {
      const url = buildQrCodeUrl('https://skillbridge.com/abc');
      expect(url).toContain('api.qrserver.com');
      expect(url).toContain(encodeURIComponent('https://skillbridge.com/abc'));
      expect(url).toContain('size=200x200');
    });

    it('returns undefined for empty input', () => {
      expect(buildQrCodeUrl('')).toBeUndefined();
    });
  });
});
