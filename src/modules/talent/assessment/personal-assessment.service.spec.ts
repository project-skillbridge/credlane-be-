import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { ErrorMessages, SuccessMessages } from '../../../shared';
import { UserRole } from '../../users/entities/user.entity';
import { TalentProfile } from '../entities/talent-profile.entity';
import { UsersService } from '../../users/users.service';
import { PersonalAssessmentService } from './personal-assessment.service';
import { createTestPersonalAssessmentQuestionService } from './personal-assessment-question.service';
import {
  makeTalentProfile,
  makeTalentUser,
  section1Answers,
} from './personal-assessment.test-fixtures';

describe('PersonalAssessmentService', () => {
  let service: PersonalAssessmentService;
  let questionCatalog: ReturnType<
    typeof createTestPersonalAssessmentQuestionService
  >;
  let usersService: Pick<UsersService, 'findOne'>;
  let repository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let warmCacheMock: jest.Mock;

  const userId = 'talent-user-1';
  let profileStore: TalentProfile;

  beforeEach(() => {
    profileStore = makeTalentProfile({ user_id: userId });

    usersService = {
      findOne: jest.fn().mockResolvedValue(makeTalentUser({ id: userId })),
    };

    const resolveProfileByUserId = (
      options: { where?: { user_id: string } } | undefined,
    ) => {
      const profileUserId = options?.where?.user_id;
      return profileUserId === userId ? profileStore : null;
    };

    const persistProfile = (profile: TalentProfile) => {
      profileStore = profile;
      return Promise.resolve(profile);
    };

    const entityManager = {
      findOne: jest
        .fn()
        .mockImplementation(
          (
            entityOrOptions: { where?: { user_id: string } },
            maybeOptions?: { where?: { user_id: string } },
          ) =>
            Promise.resolve(
              resolveProfileByUserId(maybeOptions ?? entityOrOptions),
            ),
        ),
      create: jest
        .fn()
        .mockImplementation(
          (_entity: unknown, data: Partial<TalentProfile>) => {
            profileStore = makeTalentProfile({ ...data, user_id: userId });
            return profileStore;
          },
        ),
      save: jest
        .fn()
        .mockImplementation((_entity: unknown, profile: TalentProfile) =>
          persistProfile(profile),
        ),
    };

    repository = {
      findOne: entityManager.findOne,
      create: jest.fn().mockImplementation((data: Partial<TalentProfile>) => {
        profileStore = makeTalentProfile({ ...data, user_id: userId });
        return profileStore;
      }),
      save: jest
        .fn()
        .mockImplementation((profile: TalentProfile) =>
          persistProfile(profile),
        ),
      manager: {
        transaction: jest
          .fn()
          .mockImplementation(
            (work: (manager: typeof entityManager) => Promise<unknown>) =>
              work(entityManager),
          ),
      },
    };

    questionCatalog = createTestPersonalAssessmentQuestionService();

    warmCacheMock = jest.fn().mockResolvedValue(undefined);

    service = new PersonalAssessmentService(
      repository as unknown as Repository<TalentProfile>,
      usersService as UsersService,
      questionCatalog,
      { warmCache: warmCacheMock } as any,
    );
  });

  it('saveSection persists validated answers and metadata', async () => {
    const result = await service.saveSection(userId, 1, section1Answers());

    expect(result).toEqual({
      status: 'success',
      message: SuccessMessages.ASSESSMENT.SECTION_SAVED,
      section: 1,
      progress: {
        completedSections: [1],
        nextSection: 2,
        totalSections: 5,
        sectionsCompleted: 1,
        isComplete: false,
      },
    });
    expect(profileStore.personal_assessment_answers).toMatchObject({
      job_title: 'Software Engineer',
      years_experience: '3_5_yrs',
      _meta: { completedSections: [1] },
    });
  });

  it('saveSection rejects invalid section numbers', async () => {
    await expect(service.saveSection(userId, 0, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.saveSection(userId, 6, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('saveSection returns 409 when all sections are already complete', async () => {
    profileStore.personal_assessment_answers = {
      ...section1Answers(),
      _meta: { completedSections: [1, 2, 3, 4, 5] },
    };

    const promise = service.saveSection(userId, 1, section1Answers());

    await expect(promise).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(promise).rejects.toMatchObject({
      message: ErrorMessages.ASSESSMENT.ALREADY_COMPLETED,
    });
  });

  it('saveSection returns 409 when personal assessment is already finalized', async () => {
    profileStore.personal_assessment_completed_at = new Date(
      '2026-05-01T00:00:00.000Z',
    );
    profileStore.personal_assessment_answers = null;

    const promise = service.saveSection(userId, 2, section1Answers());

    await expect(promise).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(promise).rejects.toMatchObject({
      message: ErrorMessages.ASSESSMENT.ALREADY_COMPLETED,
    });
  });

  it('includes optionItems with labels for track-specific imported questions', async () => {
    profileStore.track = 'backend_developer';
    const trackCatalog = {
      getAllQuestions: jest.fn((track?: string | null) => {
        const shared = [
          {
            key: 'claimed_level',
            questionNumber: 1,
            inputType: 'single' as const,
            required: true,
            sectionSlug: 'skills_and_expertise',
            options: ['junior', 'mid'],
          },
        ];
        if (track === 'backend_developer') {
          return [
            ...shared,
            {
              key: 'track_specialisation',
              questionNumber: 13,
              inputType: 'single' as const,
              required: true,
              sectionSlug: 'professional_background',
              prompt: 'Specialisation?',
              optionItems: [
                {
                  value: 'api_services',
                  label:
                    'API and services; I build and maintain APIs and microservices',
                },
              ],
              options: ['api_services'],
            },
          ];
        }
        return shared;
      }),
      findQuestionSection: jest.fn().mockReturnValue(1),
      getSectionQuestions: jest.fn().mockReturnValue([]),
      getOnboardingBackedQuestionKeys: jest.fn().mockReturnValue([]),
    };

    const trackService = new PersonalAssessmentService(
      repository as unknown as Repository<TalentProfile>,
      usersService as UsersService,
      trackCatalog as never,
      {} as never,
      undefined,
    );

    const result = await trackService.startGenerated(userId);
    const specialisation = result.session.questions.find(
      (question) => question.key === 'track_specialisation',
    );

    expect(specialisation?.options).toEqual(['api_services']);
    expect(specialisation?.optionItems).toEqual([
      {
        value: 'api_services',
        label: 'API and services; I build and maintain APIs and microservices',
      },
    ]);
  });

  it('submitGenerated saves sparse generated answers and completes the assessment', async () => {
    const startResult = await service.startGenerated(userId);

    const result = await service.submitGenerated(userId, {
      job_title: 'Software Engineer',
    });

    expect(result.status).toBe('success');
    expect(result.message).toBe(SuccessMessages.ASSESSMENT.COMPLETED);
    expect(profileStore.personal_assessment_completed_at).toBeInstanceOf(Date);
    expect(profileStore.personal_assessment_answers).toMatchObject({
      job_title: 'Software Engineer',
      claimed_level: 'mid',
      _meta: {
        generatedSession: expect.objectContaining({
          sessionId: startResult.session.sessionId,
        }),
        completedSections: [1, 2, 3, 4, 5],
      },
    });
    expect(warmCacheMock).toHaveBeenCalledWith(
      profileStore.track,
      expect.any(String),
    );
  });

  it('complete finalizes stored generated answers without section coverage', async () => {
    const startResult = await service.startGenerated(userId);
    profileStore.personal_assessment_answers = {
      ...section1Answers(),
      claimed_level: 'mid',
      _meta: { generatedSession: startResult.session },
    };

    const result = await service.complete(userId);

    expect(result.status).toBe('success');
    expect(result.message).toBe(SuccessMessages.ASSESSMENT.COMPLETED);
    expect(profileStore.personal_assessment_completed_at).toBeInstanceOf(Date);
    expect(profileStore.personal_assessment_answers).toMatchObject({
      claimed_level: 'mid',
      _meta: {
        generatedSession: expect.objectContaining({
          sessionId: startResult.session.sessionId,
        }),
        completedSections: [1, 2, 3, 4, 5],
      },
    });
    expect(warmCacheMock).toHaveBeenCalledWith(
      profileStore.track,
      expect.any(String),
    );
  });

  it('getResumeProgress returns section progress without creating a profile', async () => {
    profileStore.personal_assessment_answers = {
      ...section1Answers(),
      _meta: { completedSections: [1] },
    };

    const resume = await service.getResumeProgress(userId);

    expect(resume.progress).toEqual({
      completedSections: [1],
      nextSection: 2,
      totalSections: 5,
      sectionsCompleted: 1,
      isComplete: false,
    });
    expect(resume.personalAssessmentCompleted).toBe(false);
  });

  it('complete rejects when the generated session is missing', async () => {
    profileStore.personal_assessment_answers = {
      claimed_level: 'mid',
    };

    await expect(service.complete(userId)).rejects.toMatchObject({
      response: {
        message:
          'Generate a personal assessment session before submitting answers',
      },
    });
  });

  it('getAiContext does not create a profile when none exists', async () => {
    repository.findOne.mockResolvedValue(null);

    const context = await service.getAiContext(userId);

    expect(repository.save).not.toHaveBeenCalled();
    expect(context.track).toBeNull();
    expect(context.educationLevel).toBeNull();
    expect(context.country).toBe('Nigeria');
    expect(context.job_title).toBeNull();
    expect(context).not.toHaveProperty('answers');
    expect(context).not.toHaveProperty('onboarding');
  });

  it('getAiContext returns flat onboarding and answer fields', async () => {
    profileStore.personal_assessment_answers = section1Answers();

    const context = await service.getAiContext(userId);

    expect(context.track).toBe('frontend_developer');
    expect(context.educationLevel).toBe('bachelor');
    expect(context.region).toBe('Lagos');
    expect(context.linkedinProfile).toBe('https://www.linkedin.com/in/casey');
    expect(context.claimedLevel).toBe('mid');
    expect(context.country).toBe('Nigeria');
    expect(context.job_title).toBe('Software Engineer');
    expect(context.skill_track).toBe('frontend_developer');
    expect(context.education_level).toBe('bachelor');
    expect(context).not.toHaveProperty('answers');
    expect(context).not.toHaveProperty('sections');
  });
});
