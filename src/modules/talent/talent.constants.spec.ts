import { ROLE_CODE_TO_TRACK } from '../../database/import/role-code-map';
import {
  listTalentSupportedRoleTracks,
  TALENT_ROLE_TRACKS,
  TALENT_SUPPORTED_ROLE_TRACKS,
} from './talent.constants';
import { ONBOARDING_TRACK_TO_ASSESSMENT_TRACK } from './assessment/personal-assessment.schema';

describe('talent.constants', () => {
  it('exposes 20 supported role tracks aligned with Koko track_variants role codes', () => {
    expect(TALENT_SUPPORTED_ROLE_TRACKS).toHaveLength(20);
    expect(TALENT_ROLE_TRACKS).toHaveLength(20);

    for (const entry of TALENT_SUPPORTED_ROLE_TRACKS) {
      expect(ROLE_CODE_TO_TRACK[entry.roleCode]).toBe(entry.slug);
      expect(ONBOARDING_TRACK_TO_ASSESSMENT_TRACK[entry.slug]).toBeDefined();
    }
  });

  it('does not include legacy unsupported onboarding tracks', () => {
    expect(TALENT_ROLE_TRACKS).not.toContain('marketing');
    expect(TALENT_ROLE_TRACKS).not.toContain('cybersecurity');
  });

  it('lists tracks with slug, label, and roleCode for FE consumption', () => {
    const tracks = listTalentSupportedRoleTracks();

    expect(tracks).toHaveLength(20);
    expect(tracks[0]).toEqual(
      expect.objectContaining({
        slug: expect.any(String),
        label: expect.any(String),
        roleCode: expect.any(String),
      }),
    );
    expect(tracks).toContainEqual({
      slug: 'frontend_developer',
      label: 'Frontend Developer',
      roleCode: 'FED',
    });
    expect(tracks.map((track) => track.slug).sort()).toEqual(
      [...TALENT_ROLE_TRACKS].sort(),
    );
  });
});
