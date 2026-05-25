import { Repository } from 'typeorm';
import {
  BadRequestError,
  ErrorMessages,
  ForbiddenError,
  NotFoundError,
} from '../../shared';
import {
  AssessmentAttempt,
  AssessmentResponse,
  AssessmentResult,
  AssessmentTier,
  AssessmentType,
  VerifiedLevel,
} from '../assessments/entities';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../talent/entities/talent-profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { VerifiedProfileService } from './verified-profile.service';

describe('VerifiedProfileService', () => {
  let service: VerifiedProfileService;
  let usersService: Pick<UsersService, 'findOne'>;
  let talentProfileRepository: Pick<Repository<TalentProfile>, 'findOne'>;
  let employerPoolRepository: Pick<Repository<EmployerPoolProfile>, 'findOne'>;
  let assessmentResultRepository: Pick<
    Repository<AssessmentResult>,
    'createQueryBuilder'
  >;
  let assessmentAttemptRepository: Pick<
    Repository<AssessmentAttempt>,
    'findOne'
  >;
  let assessmentResponseRepository: Pick<
    Repository<AssessmentResponse>,
    'find'
  >;
  let openRouterService: { chat: jest.Mock };
  let resultQueryBuilder: {
    innerJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    getOne: jest.Mock;
  };
  let lastAssessmentType: AssessmentType | undefined;

  beforeEach(() => {
    usersService = { findOne: jest.fn() };
    talentProfileRepository = { findOne: jest.fn() };
    employerPoolRepository = { findOne: jest.fn() };

    lastAssessmentType = undefined;
    resultQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockImplementation((_clause, params) => {
        if (params?.assessmentType) {
          lastAssessmentType = params.assessmentType;
        }
        return resultQueryBuilder;
      }),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    assessmentResultRepository = {
      createQueryBuilder: jest.fn(() => resultQueryBuilder as never),
    };
    assessmentAttemptRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    assessmentResponseRepository = { find: jest.fn().mockResolvedValue([]) };

    openRouterService = { chat: jest.fn() };

    service = new VerifiedProfileService(
      talentProfileRepository as Repository<TalentProfile>,
      employerPoolRepository as Repository<EmployerPoolProfile>,
      assessmentResultRepository as Repository<AssessmentResult>,
      assessmentAttemptRepository as never,
      assessmentResponseRepository as never,
      usersService as UsersService,
      openRouterService as never,
    );
  });

  describe('getForTalentUser', () => {
    it('returns a verified profile for a job-ready talent', async () => {
      const user = makeUser();
      const profile = makeProfile({
        status: TalentProfileStatus.JOB_READY,
        goal: 'land_first_role',
        bio: 'Builder of useful products',
        track: 'frontend_developer',
        validated_level: VerifiedLevel.MID,
        personal_assessment_answers: {
          tools: ['react', 'typescript'],
          specialization: 'frontend_engineer',
        },
        advanced_assessment_completed_at: new Date('2026-05-03T00:00:00.000Z'),
        personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
      });
      const pool = Object.assign(new EmployerPoolProfile(), {
        talent_profile_id: profile.id,
        candidate_id: user.id,
        shareable_link_token: 'ab'.repeat(32),
        verified_at: new Date('2026-05-03T00:00:00.000Z'),
        verified_level: VerifiedLevel.MID,
        strong_competencies: ['technical_reasoning', 'communication'],
        competency_scores: { technical_reasoning: 92, communication: 78 },
      });

      (usersService.findOne as jest.Mock).mockResolvedValue(user);
      (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
      (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(pool);
      openRouterService.chat.mockResolvedValue({
        summary:
          'Jane is a frontend engineer with strong technical reasoning skills validated through multi-stage assessment.',
      });
      (resultQueryBuilder.getOne as jest.Mock).mockImplementation(() => {
        if (lastAssessmentType === AssessmentType.ADVANCED) {
          return Promise.resolve(
            makeResult({ tier: AssessmentTier.JOB_READY, percentage: 80 }),
          );
        }
        if (lastAssessmentType === AssessmentType.SKILL) {
          return Promise.resolve(makeResult({ percentage: 82 }));
        }
        return Promise.resolve(null);
      });

      const result = await service.getForTalentUser(user.id);

      expect(result).toMatchObject({
        full_name: 'Jane Doe',
        role: 'Frontend Developer',
        goal: 'Land First Role',
        about: 'Builder of useful products',
        skills: ['react', 'typescript'],
        verified: true,
        status: TalentProfileStatus.JOB_READY,
        ai_summary:
          'Jane is a frontend engineer with strong technical reasoning skills validated through multi-stage assessment.',
        skill_proficiency: {
          validated_level: VerifiedLevel.MID,
          skill_assessment_percentage: 82,
        },
        seniority_badge: 'Mid Level',
        tier_label: 'Job Ready',
        score_percentage: 80,
        verified_at: '2026-05-03T00:00:00.000Z',
        tier: AssessmentTier.JOB_READY,
        is_owner: true,
      });
      expect(result.key_strengths).toBeDefined();
      expect(result.key_strengths!.length).toBeGreaterThan(0);
      expect(result.share_url).toContain('/verified-profiles/');
      expect(result.qr_code_url).toContain('api.qrserver.com');
    });

    it('rejects non-talent users', async () => {
      (usersService.findOne as jest.Mock).mockResolvedValue(
        makeUser({ role: UserRole.EMPLOYER }),
      );

      await expect(service.getForTalentUser('user-1')).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });

    it('rejects when talent profile does not exist', async () => {
      (usersService.findOne as jest.Mock).mockResolvedValue(makeUser());
      (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getForTalentUser('user-1')).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('rejects when personal assessment (Stage 1) is not completed', async () => {
      const user = makeUser();
      const profile = makeProfile({
        status: TalentProfileStatus.JOB_READY,
        personal_assessment_completed_at: null,
        advanced_assessment_completed_at: new Date('2026-05-03T00:00:00.000Z'),
      });

      (usersService.findOne as jest.Mock).mockResolvedValue(user);
      (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);

      await expect(service.getForTalentUser(user.id)).rejects.toMatchObject({
        message:
          ErrorMessages.ADVANCED_ASSESSMENT.PERSONAL_ASSESSMENT_INCOMPLETE,
      });
    });

    it('rejects when no persisted verification timestamp exists', async () => {
      const user = makeUser();
      const profile = makeProfile({
        status: TalentProfileStatus.JOB_READY,
        personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
        advanced_assessment_completed_at: null,
      });

      (usersService.findOne as jest.Mock).mockResolvedValue(user);
      (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
      (resultQueryBuilder.getOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getForTalentUser(user.id)).rejects.toMatchObject({
        message: ErrorMessages.VERIFIED_PROFILE.TIMESTAMP_UNAVAILABLE,
      });
    });

    it('rejects talents who are not job-ready', async () => {
      const user = makeUser();
      const profile = makeProfile({
        status: TalentProfileStatus.EMERGING,
        personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
        advanced_assessment_completed_at: new Date(),
      });

      (usersService.findOne as jest.Mock).mockResolvedValue(user);
      (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
      (resultQueryBuilder.getOne as jest.Mock).mockResolvedValue(
        makeResult({ tier: AssessmentTier.EMERGING }),
      );

      await expect(service.getForTalentUser(user.id)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('returns avatar_url when user has one', async () => {
      const user = makeUser({
        avatar_url: 'https://example.com/avatar.jpg',
      });
      const profile = makeProfile({
        status: TalentProfileStatus.JOB_READY,
        personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
      });
      const pool = Object.assign(new EmployerPoolProfile(), {
        talent_profile_id: profile.id,
        candidate_id: user.id,
        shareable_link_token: 'ef'.repeat(32),
        verified_at: new Date('2026-05-03T00:00:00.000Z'),
        verified_level: VerifiedLevel.MID,
      });

      (usersService.findOne as jest.Mock).mockResolvedValue(user);
      (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
      (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(pool);
      (resultQueryBuilder.getOne as jest.Mock).mockResolvedValue(
        makeResult({ tier: AssessmentTier.JOB_READY }),
      );

      const result = await service.getForTalentUser(user.id);
      expect(result.avatar_url).toBe('https://example.com/avatar.jpg');
    });

    it('returns undefined optional fields when data is minimal', async () => {
      const user = makeUser();
      const profile = makeProfile({
        status: TalentProfileStatus.JOB_READY,
        personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
        bio: null,
        track: null,
        goal: null,
        validated_level: null,
        personal_assessment_answers: null,
      });
      const pool = Object.assign(new EmployerPoolProfile(), {
        talent_profile_id: profile.id,
        candidate_id: user.id,
        shareable_link_token: 'gh'.repeat(32),
        verified_at: new Date('2026-05-03T00:00:00.000Z'),
        verified_level: 'entry' as VerifiedLevel,
        strong_competencies: null,
        competency_scores: null,
      });

      (usersService.findOne as jest.Mock).mockResolvedValue(user);
      (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
      (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(pool);
      (resultQueryBuilder.getOne as jest.Mock).mockResolvedValue(
        makeResult({ tier: null, percentage: null }),
      );

      const result = await service.getForTalentUser(user.id);

      expect(result.goal).toBe('');
      expect(result.about).toBe('');
      expect(result.skills).toBeUndefined();
      expect(result.ai_summary).toBeUndefined();
      expect(result.key_strengths).toBeUndefined();
      expect(result.professional_skills).toBeUndefined();
      expect(result.soft_skills).toBeUndefined();
      expect(result.score_percentage).toBeUndefined();
      expect(result.seniority_badge).toBe('Entry Level');
      expect(result.tier_label).toBeUndefined();
    });

    it('falls back to profile_share_link when no employer pool profile exists', async () => {
      const user = makeUser();
      const profile = makeProfile({
        status: TalentProfileStatus.JOB_READY,
        personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
        profile_share_link: 'legacy-share-link-123',
      });

      (usersService.findOne as jest.Mock).mockResolvedValue(user);
      (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
      (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(null);
      (resultQueryBuilder.getOne as jest.Mock).mockResolvedValue(
        makeResult({ tier: AssessmentTier.JOB_READY }),
      );

      const result = await service.getForTalentUser(user.id);
      expect(result.share_url).toContain('legacy-share-link-123');
      expect(result.qr_code_url).toContain('api.qrserver.com');
    });

    it('gracefully degrades AI summary when OpenRouter fails', async () => {
      const user = makeUser();
      const profile = makeProfile({
        status: TalentProfileStatus.JOB_READY,
        personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
      });
      const pool = Object.assign(new EmployerPoolProfile(), {
        talent_profile_id: profile.id,
        candidate_id: user.id,
        shareable_link_token: 'ij'.repeat(32),
        verified_at: new Date('2026-05-03T00:00:00.000Z'),
        verified_level: VerifiedLevel.MID,
      });

      (usersService.findOne as jest.Mock).mockResolvedValue(user);
      (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
      (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(pool);
      openRouterService.chat.mockRejectedValue(new Error('AI service down'));
      (resultQueryBuilder.getOne as jest.Mock).mockResolvedValue(
        makeResult({ tier: AssessmentTier.JOB_READY }),
      );

      const result = await service.getForTalentUser(user.id);
      expect(result.ai_summary).toBeUndefined();
    });

    it('returns empty share_url when no token or pool link exists', async () => {
      const user = makeUser();
      const profile = makeProfile({
        status: TalentProfileStatus.JOB_READY,
        personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
        profile_share_link: null,
      });

      (usersService.findOne as jest.Mock).mockResolvedValue(user);
      (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
      (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(null);
      (resultQueryBuilder.getOne as jest.Mock).mockResolvedValue(
        makeResult({ tier: AssessmentTier.JOB_READY }),
      );

      const result = await service.getForTalentUser(user.id);
      expect(result.share_url).toBe('');
      expect(result.qr_code_url).toBeUndefined();
    });
  });

  describe('getByShareToken', () => {
    it.each(['', 'bad-token', 'abc123'])(
      'rejects malformed share token %j without querying the database',
      async (token) => {
        const promise = service.getByShareToken(token);

        await expect(promise).rejects.toBeInstanceOf(BadRequestError);
        await expect(promise).rejects.toMatchObject({
          message: ErrorMessages.VERIFIED_PROFILE.INVALID_TOKEN,
        });
        expect(employerPoolRepository.findOne).not.toHaveBeenCalled();
      },
    );

    it('rejects when pool profile is not found', async () => {
      (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(null);

      const promise = service.getByShareToken('ab'.repeat(32));
      await expect(promise).rejects.toBeInstanceOf(NotFoundError);
      await expect(promise).rejects.toMatchObject({
        message: ErrorMessages.VERIFIED_PROFILE.NOT_FOUND,
      });
    });

    it('rejects when pool profile has no talent_profile relation', async () => {
      const pool = Object.assign(new EmployerPoolProfile(), {
        candidate_id: 'user-1',
        talent_profile: null,
        shareable_link_token: 'ab'.repeat(32),
      });
      (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(pool);

      const promise = service.getByShareToken('ab'.repeat(32));
      await expect(promise).rejects.toBeInstanceOf(NotFoundError);
    });

    it('loads a verified profile by share token', async () => {
      const shareToken = 'ab'.repeat(32);

      const user = makeUser();
      const profile = makeProfile({
        status: TalentProfileStatus.JOB_READY,
        track: 'backend_developer',
        bio: 'API specialist',
        personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
      });
      const pool = Object.assign(new EmployerPoolProfile(), {
        candidate_id: user.id,
        talent_profile: profile,
        shareable_link_token: shareToken,
        verified_at: new Date('2026-05-04T00:00:00.000Z'),
        specialization: 'api_engineering',
        verified_level: VerifiedLevel.SENIOR,
      });

      (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(pool);
      (usersService.findOne as jest.Mock).mockResolvedValue(user);
      (resultQueryBuilder.getOne as jest.Mock).mockImplementation(() => {
        if (lastAssessmentType === AssessmentType.ADVANCED) {
          return Promise.resolve(
            makeResult({ tier: AssessmentTier.JOB_READY }),
          );
        }
        return Promise.resolve(null);
      });

      const result = await service.getByShareToken(shareToken);

      expect(result).toMatchObject({
        full_name: 'Jane Doe',
        role: 'Api Engineering',
        about: 'API specialist',
        verified: true,
        verified_at: '2026-05-04T00:00:00.000Z',
        skill_proficiency: { validated_level: VerifiedLevel.MID },
        is_owner: false,
      });
      expect(result.share_url).toContain(shareToken);
    });

    it('falls back to profile advanced completion when pool verified_at is missing', async () => {
      const shareToken = 'cd'.repeat(32);

      const user = makeUser();
      const profile = makeProfile({
        status: TalentProfileStatus.JOB_READY,
        track: 'backend_developer',
        personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
        advanced_assessment_completed_at: new Date('2026-05-03T12:00:00.000Z'),
      });
      const pool = Object.assign(new EmployerPoolProfile(), {
        candidate_id: user.id,
        talent_profile: profile,
        shareable_link_token: shareToken,
        verified_at: null,
        verified_level: VerifiedLevel.MID,
      });

      (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(pool);
      (usersService.findOne as jest.Mock).mockResolvedValue(user);
      (resultQueryBuilder.getOne as jest.Mock).mockImplementation(() => {
        if (lastAssessmentType === AssessmentType.ADVANCED) {
          return Promise.resolve(
            makeResult({
              tier: AssessmentTier.JOB_READY,
              created_at: new Date('2026-05-03T11:00:00.000Z'),
            }),
          );
        }
        return Promise.resolve(null);
      });

      await expect(
        service.getByShareToken(shareToken),
      ).resolves.toMatchObject({
        verified_at: '2026-05-03T12:00:00.000Z',
        tier: AssessmentTier.JOB_READY,
      });
    });
  });
});

function makeUser(overrides: Partial<User> = {}): User {
  return Object.assign(new User(), {
    id: 'user-1',
    email: 'jane@example.com',
    first_name: 'Jane',
    last_name: 'Doe',
    country: 'Nigeria',
    role: UserRole.TALENT,
    avatar_url: null,
    ...overrides,
  });
}

function makeProfile(overrides: Partial<TalentProfile>): TalentProfile {
  return Object.assign(new TalentProfile(), {
    id: 'profile-1',
    user_id: 'user-1',
    role_track: null,
    role_tracks: null,
    goal: null,
    region: null,
    education_level: null,
    linkedin_url: null,
    track: null,
    profile_verified: false,
    claimed_level: null,
    onboarding_step: 3,
    status: TalentProfileStatus.NOT_STARTED,
    bio: null,
    personal_assessment_answers: null,
    personal_assessment_completed_at: null,
    skill_assessment_completed_at: null,
    advanced_assessment_completed_at: null,
    validated_level: VerifiedLevel.MID,
    assessment_locked_from: null,
    assessment_locked_until: null,
    advanced_retake_required: false,
    profile_share_link: null,
    is_published: false,
    published_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });
}

function makeResult(overrides: Partial<AssessmentResult>): AssessmentResult {
  return Object.assign(new AssessmentResult(), {
    id: 'result-1',
    attempt_id: 'attempt-1',
    score: 80,
    max_score: 100,
    percentage: 80,
    tier: AssessmentTier.JOB_READY,
    validated_level: null,
    created_at: new Date('2026-05-03T00:00:00.000Z'),
    ...overrides,
  });
}
