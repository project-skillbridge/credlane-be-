import { Repository } from 'typeorm';
import { ForbiddenError } from '../../shared';
import { AssessmentAttempt, AssessmentResult } from '../assessments/entities';
import { EmployerAssessment } from '../employer-assessments/entities/employer-assessment.entity';
import { EmployerSavedCandidate } from '../employer-discovery/entities/employer-saved-candidate.entity';
import { EmployerProfile } from '../employer/entities/employer-profile.entity';
import { EmployerRole } from '../employer-roles/entities/employer-role.entity';
import { Offer, OfferStatus } from '../offers/entities/offer.entity';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import {
  EmployerDashboardActivityType,
  EmployerDashboardViewState,
} from './dto/employer-dashboard.dto';
import { DashboardService } from './dashboard.service';

describe('DashboardService employer home', () => {
  let service: DashboardService;
  let usersService: Pick<UsersService, 'findOne'>;
  let talentProfileRepository: Pick<Repository<any>, 'findOne'>;
  let assessmentResultRepository: Pick<
    Repository<AssessmentResult>,
    'createQueryBuilder'
  >;
  let assessmentAttemptRepository: Pick<Repository<AssessmentAttempt>, 'count'>;
  let employerProfileRepository: Pick<Repository<EmployerProfile>, 'findOne'>;
  let employerRoleRepository: Pick<
    Repository<EmployerRole>,
    'count' | 'findOne' | 'find'
  >;
  let employerSavedCandidateRepository: Pick<
    Repository<EmployerSavedCandidate>,
    'count' | 'findOne'
  >;
  let employerAssessmentRepository: Pick<
    Repository<EmployerAssessment>,
    'count'
  >;
  let employerAssessmentSubmissionRepository: Pick<
    Repository<any>,
    'createQueryBuilder'
  >;
  let offerRepository: Pick<Repository<Offer>, 'count' | 'findOne'>;
  let employerPoolProfileRepository: Pick<
    Repository<EmployerPoolProfile>,
    'count' | 'findOne'
  >;
  let notificationDispatch: { notifyAdvancedRetakeIfEligible: jest.Mock };

  beforeEach(() => {
    usersService = {
      findOne: jest.fn(),
    };

    talentProfileRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    assessmentResultRepository = {
      createQueryBuilder: jest.fn(
        () =>
          ({
            innerJoin: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            addOrderBy: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(null),
          }) as never,
      ),
    };

    assessmentAttemptRepository = {
      count: jest.fn().mockResolvedValue(0),
    };

    employerProfileRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    employerRoleRepository = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };

    employerSavedCandidateRepository = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
    };

    employerAssessmentRepository = {
      count: jest.fn().mockResolvedValue(0),
    };

    employerAssessmentSubmissionRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getRawOne: jest.fn().mockResolvedValue(null),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };

    offerRepository = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
    };

    employerPoolProfileRepository = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
    };

    notificationDispatch = {
      notifyAdvancedRetakeIfEligible: jest.fn().mockResolvedValue(undefined),
    };

    service = new DashboardService(
      talentProfileRepository as Repository<any>,
      usersService as UsersService,
      assessmentResultRepository as Repository<AssessmentResult>,
      assessmentAttemptRepository as Repository<AssessmentAttempt>,
      employerProfileRepository as Repository<EmployerProfile>,
      employerRoleRepository as Repository<EmployerRole>,
      employerSavedCandidateRepository as Repository<EmployerSavedCandidate>,
      employerAssessmentRepository as Repository<EmployerAssessment>,
      employerAssessmentSubmissionRepository as Repository<any>,
      offerRepository as Repository<Offer>,
      employerPoolProfileRepository as Repository<EmployerPoolProfile>,
      notificationDispatch as never,
    );
  });

  it('returns the new-user employer dashboard with hero content and a profile prompt', async () => {
    const employerUser = makeUser({
      first_name: 'Ada',
      last_name: 'Nwosu',
      role: UserRole.EMPLOYER,
    });

    (usersService.findOne as jest.Mock).mockResolvedValue(employerUser);

    const home = await service.getEmployerHome(employerUser.id);

    expect(home.view_state).toBe(EmployerDashboardViewState.NEW_USER);
    expect(home.company_name).toBe('Ada Nwosu');
    expect(home.profile_prompt).toMatchObject({
      show_prompt: true,
      is_verified: false,
      completion_percentage: 0,
    });
    expect(home.profile_prompt.missing_items).toEqual(
      expect.arrayContaining([
        'Add your company name',
        'Add your company LinkedIn page',
        'Complete employer verification',
      ]),
    );
    expect(home.overview_counts).toBeNull();
  });

  it('returns the existing-user employer dashboard with counts and recent activity sorted by recency', async () => {
    const employerUser = makeUser({
      first_name: 'Amaka',
      last_name: 'Labs',
      role: UserRole.EMPLOYER,
    });
    const profile = makeEmployerProfile({
      company_name: 'Amaka Labs',
      company_size: '11-50',
      industry: 'Technology',
      region: 'Lagos',
      company_website: 'https://amaka.dev',
      website_url: 'https://amaka.dev',
      linkedin_company_page_url: 'https://linkedin.com/company/amaka',
      linkedin_company_url: 'https://linkedin.com/company/amaka',
      desired_roles: ['product_designer'],
      preferred_experience_levels: ['mid'],
      is_verified: true,
    });

    (usersService.findOne as jest.Mock).mockResolvedValue(employerUser);
    (employerProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
    (employerRoleRepository.count as jest.Mock).mockResolvedValue(2);
    (employerSavedCandidateRepository.count as jest.Mock).mockResolvedValue(4);
    (employerAssessmentRepository.count as jest.Mock).mockResolvedValue(7);
    (offerRepository.count as jest.Mock).mockResolvedValue(3);
    (employerPoolProfileRepository.count as jest.Mock)
      .mockResolvedValueOnce(18)
      .mockResolvedValueOnce(2);
    (employerPoolProfileRepository.findOne as jest.Mock).mockResolvedValue(
      makePoolProfile({
        track: 'product_designer',
        verified_at: new Date('2026-06-02T12:00:00.000Z'),
      }),
    );
    (employerSavedCandidateRepository.findOne as jest.Mock).mockResolvedValue(
      makeSavedCandidate({
        created_at: new Date('2026-06-05T08:00:00.000Z'),
        candidate: makeUser({
          id: 'candidate-1',
          first_name: 'Jane',
          last_name: 'Doe',
        }),
      }),
    );
    (offerRepository.findOne as jest.Mock).mockResolvedValue(
      makeOffer({
        status: OfferStatus.ACCEPTED,
        role_title: 'Senior Product Designer',
        responded_at: new Date('2026-06-04T16:30:00.000Z'),
        candidate: makeUser({
          id: 'candidate-2',
          first_name: 'John',
          last_name: 'Stone',
        }),
      }),
    );

    const home = await service.getEmployerHome(employerUser.id);

    expect(home.view_state).toBe(EmployerDashboardViewState.EXISTING_USER);
    expect(home.company_name).toBe('Amaka Labs');
    expect(home.profile_prompt).toMatchObject({
      show_prompt: false,
      is_verified: true,
      completion_percentage: 100,
      missing_items: [],
    });
    expect(home.overview_counts).toEqual({
      verified_talent: 18,
      assessments_shared_count: expect.any(Number),
      shortlisted_candidates: 4,
      my_roles: 2,
    });
    expect(home.recent_activity).toHaveLength(3);
    expect(home.recent_activity[0]).toMatchObject({
      id: 'act_saved-1',
      type: EmployerDashboardActivityType.SHORTLIST,
      title: 'You shortlisted Jane Doe',
    });
    expect(home.recent_activity[1]).toMatchObject({
      id: 'act_offer-1',
      type: EmployerDashboardActivityType.OFFER_ACCEPTED,
      title: 'John Stone accepted your offer',
    });
    expect(home.recent_activity[2]).toMatchObject({
      id: 'act_pool-1',
      type: EmployerDashboardActivityType.VERIFIED_TALENT,
      title: '2 new verified Product Designer candidates added',
    });
  });

  it('rejects non-employer users on the employer dashboard endpoint', async () => {
    const talentUser = makeUser({
      role: UserRole.TALENT,
    });

    (usersService.findOne as jest.Mock).mockResolvedValue(talentUser);

    await expect(service.getEmployerHome(talentUser.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

function makeUser(overrides: Partial<User>): User {
  return Object.assign(new User(), {
    id: 'user-1',
    email: 'user@example.com',
    first_name: 'Test',
    last_name: 'User',
    avatar_url: null,
    country: 'Nigeria',
    is_verified: true,
    onboarding_complete: true,
    role: UserRole.EMPLOYER,
    signup_reason: null,
    refreshTokenHash: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  });
}

function makeEmployerProfile(
  overrides: Partial<EmployerProfile>,
): EmployerProfile {
  return Object.assign(new EmployerProfile(), {
    id: 'employer-profile-1',
    user_id: 'user-1',
    company_name: null,
    company_size: null,
    industry: null,
    company_website: null,
    website_url: null,
    linkedin_company_page_url: null,
    linkedin_company_url: null,
    region: null,
    hiring_region: null,
    desired_roles: null,
    hiring_roles: null,
    preferred_experience_levels: null,
    is_verified: false,
    hire_count: 0,
    created_at: new Date('2026-01-02T00:00:00.000Z'),
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  });
}

function makeSavedCandidate(
  overrides: Partial<EmployerSavedCandidate>,
): EmployerSavedCandidate {
  return Object.assign(new EmployerSavedCandidate(), {
    id: 'saved-1',
    employer_user_id: 'user-1',
    candidate_user_id: 'candidate-1',
    employer_pool_profile_id: 'pool-1',
    notes: null,
    created_at: new Date('2026-06-01T00:00:00.000Z'),
    updated_at: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  });
}

function makeOffer(overrides: Partial<Offer>): Offer {
  return Object.assign(new Offer(), {
    id: 'offer-1',
    employer_user_id: 'user-1',
    candidate_user_id: 'candidate-2',
    employer_pool_profile_id: 'pool-1',
    role_id: 'role-1',
    role_title: 'Product Designer',
    message: '',
    role_description: null,
    compensation: null,
    employment_type: null,
    work_arrangement: null,
    application_deadline: null,
    status: OfferStatus.ACCEPTED,
    expires_at: new Date('2026-06-20T00:00:00.000Z'),
    responded_at: new Date('2026-06-01T00:00:00.000Z'),
    assessment_unlocked_at: null,
    assessment_deadline: null,
    extension_used: false,
    created_at: new Date('2026-05-30T00:00:00.000Z'),
    updated_at: new Date('2026-05-30T00:00:00.000Z'),
    ...overrides,
  });
}

function makePoolProfile(
  overrides: Partial<EmployerPoolProfile>,
): EmployerPoolProfile {
  return Object.assign(new EmployerPoolProfile(), {
    id: 'pool-1',
    talent_profile_id: 'talent-profile-1',
    candidate_id: 'candidate-3',
    verified_at: new Date('2026-06-01T00:00:00.000Z'),
    track: 'product_designer',
    specialization: null,
    verified_level: 'mid',
    score: 88,
    tier: 'job_ready',
    strong_competencies: ['ux_research'],
    competency_scores: null,
    industry_background: null,
    work_preferences: null,
    availability: 'immediate',
    job_search_status: 'actively_looking',
    location: 'Lagos',
    integrity_clean: true,
    profile_url: null,
    shareable_link_token: null,
    created_at: new Date('2026-06-01T00:00:00.000Z'),
    updated_at: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  });
}
