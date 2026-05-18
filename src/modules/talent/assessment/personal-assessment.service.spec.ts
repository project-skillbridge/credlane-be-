import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SuccessMessages } from '../../../shared';
import { OAUTH_DEFAULT_COUNTRY } from '../../users/users.service';
import { UserRole } from '../../users/entities/user.entity';
import { TalentProfile } from '../entities/talent-profile.entity';
import { UsersService } from '../../users/users.service';
import { PersonalAssessmentService } from './personal-assessment.service';
import {
  buildFullPersonalAssessmentAnswers,
  makeTalentProfile,
  makeTalentUser,
  section1Answers,
} from './personal-assessment.test-fixtures';

describe('PersonalAssessmentService', () => {
  let service: PersonalAssessmentService;
  let usersService: Pick<UsersService, 'findOne'>;
  let repository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const userId = 'talent-user-1';
  let profileStore: TalentProfile;

  beforeEach(() => {
    profileStore = makeTalentProfile({ user_id: userId });

    usersService = {
      findOne: jest.fn().mockResolvedValue(makeTalentUser({ id: userId })),
    };

    repository = {
      findOne: jest.fn().mockImplementation(({ where }: { where: { user_id: string } }) =>
        Promise.resolve(where.user_id === userId ? profileStore : null),
      ),
      create: jest.fn().mockImplementation((data: Partial<TalentProfile>) => {
        profileStore = makeTalentProfile({ ...data, user_id: userId });
        return profileStore;
      }),
      save: jest.fn().mockImplementation((profile: TalentProfile) => {
        profileStore = profile;
        return Promise.resolve(profile);
      }),
    };

    service = new PersonalAssessmentService(
      repository as unknown as Repository<TalentProfile>,
      usersService as UsersService,
    );
  });

  it('saveSection persists validated answers and metadata', async () => {
    const result = await service.saveSection(userId, 1, section1Answers());

    expect(result).toEqual({
      status: 'success',
      message: SuccessMessages.ASSESSMENT.SECTION_SAVED,
      section: 1,
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
    await expect(service.saveSection(userId, 8, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('complete marks personal assessment finished when data is valid', async () => {
    profileStore.personal_assessment_answers = {
      ...buildFullPersonalAssessmentAnswers(),
      _meta: { completedSections: [1, 2, 3, 4, 5, 6, 7] },
    };

    const result = await service.complete(userId);

    expect(result.status).toBe('success');
    expect(result.message).toBe(SuccessMessages.ASSESSMENT.COMPLETED);
    expect(profileStore.personal_assessment_completed_at).toBeInstanceOf(Date);
  });

  it('complete rejects Unknown country', async () => {
    profileStore.personal_assessment_answers = {
      ...buildFullPersonalAssessmentAnswers(),
      _meta: { completedSections: [1, 2, 3, 4, 5, 6, 7] },
    };
    (usersService.findOne as jest.Mock).mockResolvedValue(
      makeTalentUser({ id: userId, country: OAUTH_DEFAULT_COUNTRY }),
    );

    await expect(service.complete(userId)).rejects.toMatchObject({
      response: {
        missingOnboardingFields: expect.arrayContaining(['country']),
      },
    });
  });

  it('getAiContext merges stored answers with onboarding fields', async () => {
    profileStore.personal_assessment_answers = section1Answers();

    const context = await service.getAiContext(userId);

    expect(context.userId).toBe(userId);
    expect(context.onboarding).toEqual({
      track: 'frontend_developer',
      educationLevel: 'bachelor',
      region: 'Lagos',
      linkedinProfile: 'https://www.linkedin.com/in/casey',
      claimedLevel: 'intermediate',
      country: 'Nigeria',
    });
    expect(context.answers.job_title).toBe('Software Engineer');
    expect(context.answers.skill_track).toBe('frontend_developer');
    expect(context.answers.country).toBe('Nigeria');
    expect(context.sections[1].job_title).toBe('Software Engineer');
    expect(context.personalAssessmentCompleted).toBe(false);
  });
});
