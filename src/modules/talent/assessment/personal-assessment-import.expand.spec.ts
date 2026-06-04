import { expandPersonalAssessmentImportItems } from './personal-assessment-import.expand';

describe('expandPersonalAssessmentImportItems', () => {
  const baseItem = {
    id: 'PA-GEN-PRO-013',
    section: 'professional_background',
    track: 'all',
    question: 'Specialisation?',
    fieldName: 'track_specialisation',
    format: 'single_select' as const,
    required: true,
  };

  it('expands track_variants into per-track rows with stable ids', () => {
    const rows = expandPersonalAssessmentImportItems({
      ...baseItem,
      trackVariants: {
        FED: {
          options: [{ value: 'ui_focused', label: 'UI-focused' }],
        },
        PMG: {
          options: [{ value: 'technical_pm', label: 'Technical PM' }],
        },
      },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 'PA-GEN-PRO-013__FED',
      track: 'frontend_developer',
      fieldName: 'track_specialisation',
      options: [{ value: 'ui_focused', label: 'UI-focused' }],
    });
    expect(rows[1]).toMatchObject({
      id: 'PA-GEN-PRO-013__PMG',
      track: 'product_manager',
    });
  });

  it('returns a single base row for text questions without options or track_variants', () => {
    const rows = expandPersonalAssessmentImportItems({
      ...baseItem,
      id: 'PA-GEN-PRO-013',
      fieldName: 'ideal_work_environment',
      format: 'text_required',
      question: 'Describe your ideal work environment',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'PA-GEN-PRO-013',
      track: 'all',
      format: 'text_required',
      options: null,
    });
  });

  it('rejects variant ids that would exceed the database id limit', () => {
    expect(() =>
      expandPersonalAssessmentImportItems({
        ...baseItem,
        id: 'PA-GEN-PRO-013-EXTRA-LONG-BASE-ID-NEAR-LIMIT-XX',
        trackVariants: {
          FED: { options: [{ value: 'ui_focused', label: 'UI-focused' }] },
        },
      }),
    ).toThrow(/exceeds 50 characters/);
  });

  it('keeps a base row when top-level options are provided', () => {
    const rows = expandPersonalAssessmentImportItems({
      ...baseItem,
      options: [{ value: 'general', label: 'General' }],
      trackVariants: {
        FED: { options: [{ value: 'ui_focused', label: 'UI-focused' }] },
      },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 'PA-GEN-PRO-013',
      track: 'all',
      options: [{ value: 'general', label: 'General' }],
    });
  });
});
