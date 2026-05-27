import {
  keysToCamel,
  keysToSnake,
  REQUEST_CASE_TRANSFORM_OPTIONS,
} from './case-transform';

describe('case-transform', () => {
  it('converts snake_case keys to camelCase recursively', () => {
    expect(
      keysToCamel({
        first_name: 'Alex',
        nested: { role_track: 'frontend_developer' },
      }),
    ).toEqual({
      firstName: 'Alex',
      nested: { roleTrack: 'frontend_developer' },
    });
  });

  it('preserves personal assessment answer keys when configured', () => {
    expect(
      keysToCamel(
        {
          answers: { job_title: 'Engineer', claimedLevel: 'mid' },
        },
        REQUEST_CASE_TRANSFORM_OPTIONS,
      ),
    ).toEqual({
      answers: { job_title: 'Engineer', claimedLevel: 'mid' },
    });
  });

  it('converts camelCase keys to snake_case recursively', () => {
    expect(
      keysToSnake({
        firstName: 'Alex',
        questionId: 'uuid',
      }),
    ).toEqual({
      first_name: 'Alex',
      question_id: 'uuid',
    });
  });
});
