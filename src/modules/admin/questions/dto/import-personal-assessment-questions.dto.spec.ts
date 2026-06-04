import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ImportPersonalAssessmentQuestionsDto } from './import-personal-assessment-questions.dto';

describe('ImportPersonalAssessmentQuestionsDto', () => {
  it('accepts select questions with track_variants only', async () => {
    const dto = plainToInstance(ImportPersonalAssessmentQuestionsDto, {
      questions: [
        {
          id: 'PA-GEN-PRO-013',
          section: 'professional_background',
          track: 'all',
          question: 'Specialisation?',
          fieldName: 'track_specialisation',
          format: 'single_select',
          required: true,
          note: 'Per-track options',
          trackVariants: {
            FED: {
              options: [{ value: 'ui_focused', label: 'UI-focused' }],
            },
          },
        },
      ],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects select questions without options or track_variants', async () => {
    const dto = plainToInstance(ImportPersonalAssessmentQuestionsDto, {
      questions: [
        {
          id: 'PA-GEN-PRO-013',
          section: 'professional_background',
          track: 'all',
          question: 'Specialisation?',
          fieldName: 'track_specialisation',
          format: 'single_select',
          required: true,
        },
      ],
    });

    const errors = await validate(dto);
    const itemErrors = errors.find((error) => error.property === 'questions');
    const nested = itemErrors?.children?.[0]?.children ?? [];

    expect(
      nested.some(
        (error) =>
          error.constraints &&
          Object.values(error.constraints).some((message) =>
            message.includes('options or trackVariants'),
          ),
      ),
    ).toBe(true);
  });
});
