import { Repository } from 'typeorm';
import {
  BadRequestError,
  ErrorMessages,
  ForbiddenError,
  NotFoundError,
} from '../../shared';
import {
  AssessmentAttempt,
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentResult,
  AssessmentScore,
  AssessmentTier,
  AssessmentType,
  VerifiedLevel,
} from '../assessments/entities';
import { EmployerPoolProfile } from '../talent/entities/employer-pool-profile.entity';
import {
  TalentAvailabilityStatus,
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
  let assessmentScoreRepository: Pick<Repository<AssessmentScore>, 'find'>;
  let assessmentQuestionRepository: Pick<
    Repository<AssessmentQuestion>,
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
    assessmentScoreRepository = { find: jest.fn().mockResolvedValue([]) };
    assessmentQuestionRepository = { find: jest.fn().mockResolvedValue([]) };

    openRouterService = { chat: jest.fn() };

    service = new VerifiedProfileService(
      talentProfileRepository as Repository<TalentProfile>,
      employerPoolRepository as Repository<EmployerPoolProfile>,
      assessmentResultRepository as Repository<AssessmentResult>,
      assessmentAttemptRepository as never,
      assessmentResponseRepository as never,
      assessmentScoreRepository as never,
      assessmentQuestionRepository as never,
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
        resume_url: 'https://cdn.example.com/resumes/jane.pdf',
        personal_assessment_answers: {
          tools: ['react', 'typescript'],
          specialization: 'frontend_engineer',
          years_experience: '3_5_yrs',
          job_search_status: 'open_to_right_opportunity',
          work_arrangement_preference: ['fully_remote', 'hybrid'],
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
        availability: 'immediately_available',
        work_preferences: {
          workStyle: 'async_collaboration',
          teamSize: 'small_teams',
        },
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
            makeResult({
              tier: AssessmentTier.JOB_READY,
              percentage: 80,
              guidance_report: {
                ai_summary:
                  'Jane shows job-ready frontend strengths and strong product reasoning.',
                growth_insight:
                  'Jane should keep deepening systems thinking and stakeholder communication.',
                summary: 'Jane showed job-ready strengths.',
                strength_ratings: [
                  { item: 'Clear practical problem solving.', rating: 3 },
                ],
                weak_area_ratings: [
                  { item: 'Improve systems-level reasoning.', rating: 1 },
                ],
                recommended_resources: [
                  {
                    title: 'Frontend Patterns',
                    provider: 'SkillBridge',
                    url: 'https://example.com/frontend-patterns',
                    tier: 'free',
                    competency: 'technical_reasoning',
                    reason: 'Supports frontend architecture growth.',
                  },
                ],
                resource_page_url: '/resources',
              },
            }),
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
        ai_report:
          'Jane shows job-ready frontend strengths and strong product reasoning.',
        seniority_badge: 'Mid Level',
        tier_label: 'Job Ready',
        score_percentage: 80,
        resume_url: 'https://cdn.example.com/resumes/jane.pdf',
        verified_at: '2026-05-03T00:00:00.000Z',
        tier: AssessmentTier.JOB_READY,
        is_owner: true,
        resource_page_url: '/resources',
      });
      expect(result).not.toHaveProperty('aiReport');
      expect(result).not.toHaveProperty('ai_summary');
      expect(result).not.toHaveProperty('detailedSkills');
      expect(result).not.toHaveProperty('key_strengths');
      expect(result).not.toHaveProperty('professional_skills');
      // '3-5 yrs exp.' must not appear alongside 'Mid Level' — validated level
      // is authoritative and the self-reported experience label is suppressed.
      expect(result.about_tags).toEqual([
        'Mid Level',
        'Job Ready',
        'Open to Work',
        'Fully Remote',
        'Hybrid',
        'Immediately Available',
      ]);
      expect(result).not.toHaveProperty('detailed_skills');
      expect(result.working_style).toEqual([
        'Async Collaboration',
        'Small Teams',
        'Fully Remote',
        'Hybrid',
      ]);
      expect(result.growth_insight).toBe(
        'Jane should keep deepening systems thinking and stakeholder communication.',
      );
      expect(result.recommended_resources).toEqual([
        {
          title: 'Frontend Patterns',
          provider: 'SkillBridge',
          url: 'https://example.com/frontend-patterns',
          tier: 'free',
          competency: 'technical_reasoning',
          reason: 'Supports frontend architecture growth.',
        },
      ]);
      expect(result.skill_breakdown_tabs).toEqual([
        {
          id: 'assessment_scores',
          label: 'Assessment Scores',
          items: [
            {
              id: 'skill_proficiency',
              label: 'Skill Proficiency',
              percentage: 80,
              validated_level: VerifiedLevel.MID,
              insight: 'Jane showed job-ready strengths.',
            },
            {
              id: 'workplace_readiness',
              label: 'Workplace Readiness',
              percentage: 0,
              insight:
                'Jane should keep deepening systems thinking and stakeholder communication.',
            },
            {
              id: 'practical_application',
              label: 'Practical Application',
              percentage: 0,
              insight:
                'Jane should keep deepening systems thinking and stakeholder communication.',
            },
          ],
        },
        {
          id: 'professional_skills',
          label: 'Professional Skills',
          items: [
            {
              label: 'Technical Reasoning',
              percentage: 92,
              insight:
                'Jane should keep deepening systems thinking and stakeholder communication.',
            },
          ],
        },
        {
          id: 'key_strengths',
          label: 'Strengths',
          items: [
            {
              competency: 'technical_reasoning',
              label: 'Technical Reasoning',
              percentage: 92,
              insight:
                'Jane should keep deepening systems thinking and stakeholder communication.',
            },
            {
              competency: 'communication',
              label: 'Communication',
              percentage: 78,
              insight:
                'Jane should keep deepening systems thinking and stakeholder communication.',
            },
          ],
        },
        {
          id: 'working_style',
          label: 'Working Style',
          items: [
            {
              label: 'Async Collaboration',
              percentage: 100,
              insight:
                'Jane should keep deepening systems thinking and stakeholder communication.',
            },
            {
              label: 'Small Teams',
              percentage: 100,
              insight:
                'Jane should keep deepening systems thinking and stakeholder communication.',
            },
            {
              label: 'Fully Remote',
              percentage: 100,
              insight:
                'Jane should keep deepening systems thinking and stakeholder communication.',
            },
            {
              label: 'Hybrid',
              percentage: 100,
              insight:
                'Jane should keep deepening systems thinking and stakeholder communication.',
            },
          ],
        },
        {
          id: 'weaknesses',
          label: 'Weaknesses',
          items: [
            {
              label: 'Improve systems-level reasoning.',
              percentage: 20,
              insight:
                'Jane should keep deepening systems thinking and stakeholder communication.',
            },
          ],
        },
      ]);
      expect(result.share_url).toContain('/verified-profiles/');
      expect(result.qr_code_url).toContain('api.qrserver.com');
    });

    it('resolves UUID competency score keys to question competency labels', async () => {
      const user = makeUser();
      const profile = makeProfile({
        status: TalentProfileStatus.JOB_READY,
        track: 'frontend_developer',
        personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
        advanced_assessment_completed_at: new Date('2026-05-03T00:00:00.000Z'),
      });
      const questionId = '0b1131db-d55e-43f8-89b9-f32fde01871b';
      const pool = Object.assign(new EmployerPoolProfile(), {
        talent_profile_id: profile.id,
        candidate_id: user.id,
        shareable_link_token: 'ab'.repeat(32),
        verified_at: new Date('2026-05-03T00:00:00.000Z'),
        tier: AssessmentTier.JOB_READY,
        strong_competencies: [questionId],
        competency_scores: { [questionId]: 100 },
      });

      (usersService.findOne as jest.Mock).mockResolvedValue(user);
      (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
      (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(pool);
      (assessmentQuestionRepository.find as jest.Mock).mockResolvedValue([
        Object.assign(new AssessmentQuestion(), {
          id: questionId,
          competency: 'api_design',
          metadata: null,
        }),
      ]);
      openRouterService.chat.mockResolvedValue({ summary: 'Summary' });
      (resultQueryBuilder.getOne as jest.Mock).mockImplementation(() => {
        if (lastAssessmentType === AssessmentType.ADVANCED) {
          return Promise.resolve(
            makeResult({
              attempt_id: 'attempt-1',
              tier: AssessmentTier.JOB_READY,
              percentage: 86,
            }),
          );
        }
        return Promise.resolve(null);
      });

      const result = await service.getForTalentUser(user.id);

      const strengthsTab = result.skill_breakdown_tabs.find(
        (tab) => tab.id === 'key_strengths',
      );
      expect(strengthsTab?.items).toEqual([
        { competency: 'api_design', label: 'Api Design', percentage: 100 },
      ]);
      const professionalTab = result.skill_breakdown_tabs.find(
        (tab) => tab.id === 'professional_skills',
      );
      expect(professionalTab?.items).toEqual([
        { label: 'Api Design', percentage: 100 },
      ]);
      expect(JSON.stringify(result)).not.toContain(questionId);
    });

    it('omits self-reported experience label when validated_level is present', async () => {
      // Regression guard: about_tags must not contain both "Senior Level" and
      // "1-3 yrs exp." — the validated badge supersedes the self-report.
      const user = makeUser();
      const profile = makeProfile({
        status: TalentProfileStatus.JOB_READY,
        track: 'backend_developer',
        validated_level: VerifiedLevel.SENIOR,
        personal_assessment_answers: {
          years_experience: '1_3_yrs',
          job_search_status: 'open_to_right_opportunity',
          work_arrangement_preference: [],
        },
        advanced_assessment_completed_at: new Date('2026-05-10T00:00:00.000Z'),
        personal_assessment_completed_at: new Date('2026-05-08T00:00:00.000Z'),
      });
      const pool = Object.assign(new EmployerPoolProfile(), {
        talent_profile_id: profile.id,
        candidate_id: user.id,
        shareable_link_token: 'cd'.repeat(32),
        verified_at: new Date('2026-05-10T00:00:00.000Z'),
        verified_level: VerifiedLevel.SENIOR,
      });

      (usersService.findOne as jest.Mock).mockResolvedValue(user);
      (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
      (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(pool);
      openRouterService.chat.mockResolvedValue({ summary: 'Summary.' });
      (resultQueryBuilder.getOne as jest.Mock).mockImplementation(() => {
        if (lastAssessmentType === AssessmentType.ADVANCED) {
          return Promise.resolve(
            makeResult({ tier: AssessmentTier.JOB_READY, percentage: 85 }),
          );
        }
        return Promise.resolve(null);
      });

      const result = await service.getForTalentUser(user.id);

      expect(result.about_tags).toContain('Senior Level');
      expect(result.about_tags).not.toContain('1-3 yrs exp.');
    });

    it('includes experience label in about_tags when no persisted validated level exists', async () => {
      // Neither profile.validated_level nor poolProfile.verified_level is set —
      // hasValidatedLevel is false so the self-reported label must appear.
      const user = makeUser();
      const profile = makeProfile({
        status: TalentProfileStatus.JOB_READY,
        track: 'backend_developer',
        validated_level: undefined,
        personal_assessment_answers: {
          years_experience: '5_10_yrs',
          job_search_status: 'actively_looking',
          work_arrangement_preference: [],
        },
        advanced_assessment_completed_at: new Date('2026-05-10T00:00:00.000Z'),
        personal_assessment_completed_at: new Date('2026-05-08T00:00:00.000Z'),
      });
      const pool = Object.assign(new EmployerPoolProfile(), {
        talent_profile_id: profile.id,
        candidate_id: user.id,
        shareable_link_token: 'ef'.repeat(32),
        verified_at: new Date('2026-05-10T00:00:00.000Z'),
        verified_level: null,
      });

      (usersService.findOne as jest.Mock).mockResolvedValue(user);
      (talentProfileRepository.findOne as jest.Mock).mockResolvedValue(profile);
      (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(pool);
      openRouterService.chat.mockResolvedValue({ summary: 'Summary.' });
      (resultQueryBuilder.getOne as jest.Mock).mockImplementation(() => {
        if (lastAssessmentType === AssessmentType.ADVANCED) {
          return Promise.resolve(
            makeResult({ tier: AssessmentTier.JOB_READY, percentage: 78 }),
          );
        }
        return Promise.resolve(null);
      });

      const result = await service.getForTalentUser(user.id);

      expect(result.about_tags).toContain('5-10 yrs exp.');
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
        score: 76,
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
      expect(result.skills).toEqual([]);
      expect(result.ai_report).toBe('');
      expect(result.growth_insight).toBe('');
      expect(result.recommended_resources).toEqual([]);
      expect(result.qr_code_url).toContain('api.qrserver.com');
      expect(result).not.toHaveProperty('ai_summary');
      expect(result.skill_breakdown_tabs).toEqual([
        {
          id: 'assessment_scores',
          label: 'Assessment Scores',
          items: [
            {
              id: 'skill_proficiency',
              label: 'Skill Proficiency',
              percentage: 76,
              validated_level: 'entry',
              insight: 'Assessment insights are not available yet.',
            },
            {
              id: 'workplace_readiness',
              label: 'Workplace Readiness',
              percentage: 0,
              insight: 'Assessment insights are not available yet.',
            },
            {
              id: 'practical_application',
              label: 'Practical Application',
              percentage: 0,
              insight: 'Assessment insights are not available yet.',
            },
          ],
        },
        {
          id: 'professional_skills',
          label: 'Professional Skills',
          items: [{ label: 'General', percentage: 76 }],
        },
        {
          id: 'key_strengths',
          label: 'Strengths',
          items: [{ competency: 'general', label: 'General', percentage: 76 }],
        },
      ]);
      expect(result).not.toHaveProperty('detailed_skills');
      expect(result.score_percentage).toBe(76);
      expect(result.seniority_badge).toBe('Entry Level');
      expect(result.tier_label).toBe('');
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
      expect(result).not.toHaveProperty('ai_summary');
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
      expect(result.qr_code_url).toBeNull();
    });
  });

  describe('getForEmployerView', () => {
    it('returns the verified profile contract for a job-ready pool candidate', async () => {
      const user = makeUser();
      const profile = makeProfile({
        status: TalentProfileStatus.JOB_READY,
        personal_assessment_completed_at: new Date('2026-05-01T00:00:00.000Z'),
      });
      const pool = Object.assign(new EmployerPoolProfile(), {
        talent_profile_id: profile.id,
        candidate_id: user.id,
        tier: AssessmentTier.JOB_READY,
        talent_profile: profile,
        shareable_link_token: 'ab'.repeat(32),
        verified_at: new Date('2026-05-03T00:00:00.000Z'),
      });

      (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(pool);
      (usersService.findOne as jest.Mock).mockResolvedValue(user);
      (resultQueryBuilder.getOne as jest.Mock).mockResolvedValue(
        makeResult({ tier: AssessmentTier.JOB_READY, percentage: 85 }),
      );

      const result = await service.getForEmployerView(user.id);

      expect(result.full_name).toBe('Jane Doe');
      expect(result.score_percentage).toBe(85);
      expect(result.is_owner).toBe(false);
    });

    it('rejects candidates that are not in the job-ready pool', async () => {
      (employerPoolRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getForEmployerView('missing-user'),
      ).rejects.toBeInstanceOf(NotFoundError);
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
        role: 'Backend Developer',
        about: 'API specialist',
        verified: true,
        verified_at: '2026-05-04T00:00:00.000Z',
        is_owner: false,
      });
      const assessmentTab = result.skill_breakdown_tabs.find(
        (tab) => tab.id === 'assessment_scores',
      );
      expect(assessmentTab?.items[0]).toMatchObject({
        id: 'skill_proficiency',
        validated_level: VerifiedLevel.MID,
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

      await expect(service.getByShareToken(shareToken)).resolves.toMatchObject({
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
    personal_website: null,
    resume_url: null,
    availability_status: TalentAvailabilityStatus.OPEN_TO_OPPORTUNITIES,
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
