import { mapDiscoveryCandidateCard } from './discovery-candidate.mapper';

describe('mapDiscoveryCandidateCard', () => {
  it('maps raw pool rows into design-facing candidate cards', () => {
    const card = mapDiscoveryCandidateCard(
      {
        userId: 'user-1',
        roleTrack: 'frontend_developer',
        tier: 'job_ready',
        availability: 'immediately_available',
        verifiedAt: new Date('2026-05-03T00:00:00.000Z'),
        score: 85,
        strongCompetencies: ['api_design'],
        shareToken: 'token',
        firstName: 'Jane',
        lastName: 'Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        country: 'Nigeria',
        verifiedLevel: 'mid',
        location: 'Lagos, Nigeria',
        jobSearchStatus: 'open_to_opportunities',
        specialization: null,
        personalAssessmentAnswers: {
          tools: ['react', 'typescript'],
          work_arrangement_preference: ['fully_remote', 'hybrid'],
        },
      },
      {
        is_saved: true,
        offer_sent: false,
        offer_status: null,
      },
    );

    expect(card).toMatchObject({
      user_id: 'user-1',
      full_name: 'Jane Doe',
      avatar_url: 'https://example.com/avatar.jpg',
      role: 'Frontend Developer',
      role_track: 'frontend_developer',
      seniority_badge: 'Mid Level',
      score: 85,
      skills: ['react', 'typescript'],
      availability_label: 'Immediately Available',
      region: 'Lagos, Nigeria',
      is_saved: true,
    });
    expect(card.about_tags).toEqual(
      expect.arrayContaining(['Mid Level', 'Job Ready', 'Open to Work']),
    );
  });
});
