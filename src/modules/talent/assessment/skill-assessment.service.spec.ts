import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AssessmentAttempt, AssessmentType } from '../../assessments/entities';
import { TalentProfile } from '../entities/talent-profile.entity';
import { ErrorMessages } from '../../../shared';
import { SKILL_ASSESSMENT_MAX_ATTEMPTS } from '../talent.constants';
import { SkillAssessmentService } from './skill-assessment.service';
import { makeTalentProfile } from './personal-assessment.test-fixtures';

describe('SkillAssessmentService', () => {
  let service: SkillAssessmentService;

  let talentProfileRepo: {
    findOne: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let attemptRepo: {
    count: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let questionRepo: Record<string, jest.Mock>;
  let personalAssessmentService: { getAiContext: jest.Mock };
  let questionGeneration: { generateQuestions: jest.Mock };

  const userId = 'talent-user-1';
  let profile = makeTalentProfile({
    personal_assessment_completed_at: new Date(),
    claimed_level: 'mid' as never,
    track: 'frontend_developer',
    advanced_assessment_completed_at: null,
  });

  function mockTransaction() {
    talentProfileRepo.manager.transaction.mockImplementation(
      async (work: (manager: EntityManagerLike) => Promise<unknown>) => {
        const manager: EntityManagerLike = {
          findOne: jest.fn().mockResolvedValue(profile),
          getRepository: jest.fn(() => attemptRepo),
          create: jest.fn(
            (
              _entity: typeof AssessmentAttempt,
              data: Partial<AssessmentAttempt>,
            ) => attemptRepo.create(data),
          ),
          save: jest.fn(
            (_entity: typeof AssessmentAttempt, data: AssessmentAttempt) =>
              attemptRepo.save(data),
          ),
        };
        return work(manager);
      },
    );
  }

  beforeEach(() => {
    profile = makeTalentProfile({
      personal_assessment_completed_at: new Date(),
      claimed_level: 'mid' as never,
      track: 'frontend_developer',
      advanced_assessment_completed_at: null,
    });

    attemptRepo = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => Object.assign(new AssessmentAttempt(), data)),
      save: jest.fn(async (data) =>
        Object.assign(new AssessmentAttempt(), data, { id: 'attempt-1' }),
      ),
    };

    questionRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => data),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: '0' }),
      })),
    };

    questionGeneration = {
      generateQuestions: jest.fn().mockResolvedValue([]),
    };

    talentProfileRepo = {
      findOne: jest.fn().mockResolvedValue(profile),
      manager: { transaction: jest.fn() },
    };

    mockTransaction();

    personalAssessmentService = {
      getAiContext: jest
        .fn()
        .mockResolvedValue({ track: 'frontend_developer' }),
    };

    service = new SkillAssessmentService(
      talentProfileRepo as never,
      questionRepo as never,
      attemptRepo as never,
      {} as never,
      {} as never,
      {} as never,
      { scoreAnswers: jest.fn() } as never,
      { generate: jest.fn() } as never,
      questionGeneration as never,
      personalAssessmentService as never,
    );
  });

  it(`blocks start when ${SKILL_ASSESSMENT_MAX_ATTEMPTS} skill attempts are already completed`, async () => {
    attemptRepo.count.mockResolvedValue(SKILL_ASSESSMENT_MAX_ATTEMPTS);

    await expect(service.start(userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.start(userId)).rejects.toMatchObject({
      message: ErrorMessages.SKILL_ASSESSMENT.MAX_ATTEMPTS_REACHED,
    });
    expect(talentProfileRepo.manager.transaction).not.toHaveBeenCalled();
    expect(attemptRepo.save).not.toHaveBeenCalled();
  });

  it('blocks start when an active skill session already exists under lock', async () => {
    attemptRepo.count.mockResolvedValue(2);
    attemptRepo.findOne.mockResolvedValue(
      Object.assign(new AssessmentAttempt(), { id: 'active-attempt' }),
    );

    await expect(service.start(userId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(attemptRepo.save).not.toHaveBeenCalled();
  });

  it('does not enforce attempt limit after advanced assessment is complete', async () => {
    profile.advanced_assessment_completed_at = new Date();
    attemptRepo.count.mockResolvedValue(SKILL_ASSESSMENT_MAX_ATTEMPTS);

    await expect(
      (
        service as unknown as {
          assertSkillAssessmentAttemptsRemaining: (
            p: TalentProfile,
          ) => Promise<void>;
        }
      ).assertSkillAssessmentAttemptsRemaining(profile),
    ).resolves.toBeUndefined();

    expect(attemptRepo.count).not.toHaveBeenCalled();
  });
});

type EntityManagerLike = {
  findOne: jest.Mock;
  getRepository: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};
