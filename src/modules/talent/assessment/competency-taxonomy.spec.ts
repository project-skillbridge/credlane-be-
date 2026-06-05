import {
  FALLBACK_COMPETENCY,
  resolveQuestionCompetency,
  slugifyCompetency,
} from './competency-taxonomy';

describe('competency-taxonomy helpers', () => {
  describe('slugifyCompetency', () => {
    it('normalises human-readable labels', () => {
      expect(slugifyCompetency('Component Architecture')).toBe(
        'component_architecture',
      );
    });

    it('returns null for inputs with no alphanumeric characters', () => {
      expect(slugifyCompetency('!!!!')).toBeNull();
      expect(slugifyCompetency('   ')).toBeNull();
      expect(slugifyCompetency('---')).toBeNull();
    });
  });

  describe('resolveQuestionCompetency', () => {
    it('prefers a specific column competency', () => {
      expect(
        resolveQuestionCompetency({
          competency: 'api_design',
          metadata: { source_competency: 'Security' },
        }),
      ).toBe('api_design');
    });

    it('falls back to source_competency when column is general', () => {
      expect(
        resolveQuestionCompetency({
          competency: FALLBACK_COMPETENCY,
          metadata: { source_competency: 'Component Architecture' },
        }),
      ).toBe('component_architecture');
    });

    it('uses metadata.competency when column is missing', () => {
      expect(
        resolveQuestionCompetency({
          metadata: { competency: 'data_quality' },
        }),
      ).toBe('data_quality');
    });
  });
});
