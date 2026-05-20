import { ForbiddenException } from '@nestjs/common';
import { AssessmentType } from '../../assessments/entities';
import { ErrorMessages } from '../../../shared';
import { SKILL_ASSESSMENT_MAX_ATTEMPTS } from '../talent.constants';
import { SkillAssessmentService } from './skill-assessment.service';
import { makeTalentProfile } from './personal-assessment.test-fixtures';

describe('SkillAssessmentService', () => {
  let service: SkillAssessmentService;

  let talentProfileRepo: { findOne: jest.Mock };
  let attemptRepo: { count: jest.Mock; create: jest.Mock; save: jest.Mock };
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

  beforeEach(() => {
    profile = makeTalentProfile({
      personal_assessment_completed_at: new Date(),
      claimed_level: 'mid' as never,
      track: 'frontend_developer',
      advanced_assessment_completed_at: null,
    });

    attemptRepo = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      save: jest.fn(),
    };

    questionRepo = {};
    questionGeneration = {
      generateQuestions: jest.fn().mockResolvedValue([]),
    };

    talentProfileRepo = {
      findOne: jest.fn().mockResolvedValue(profile),
    };

    personalAssessmentService = {
      getAiContext: jest.fn().mockResolvedValue({ track: 'frontend_developer' }),
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
    expect(attemptRepo.count).toHaveBeenCalledWith({
      where: {
        talent_profile_id: profile.id,
        assessment_type: AssessmentType.SKILL,
        completed_at: expect.anything(),
      },
    });
  });

  it('does not enforce attempt limit after advanced assessment is complete', async () => {
    profile.advanced_assessment_completed_at = new Date();
    attemptRepo.count.mockResolvedValue(SKILL_ASSESSMENT_MAX_ATTEMPTS);

    await expect(
      (
        service as unknown as {
          assertSkillAssessmentAttemptsRemaining: (
            p: typeof profile,
          ) => Promise<void>;
        }
      ).assertSkillAssessmentAttemptsRemaining(profile),
    ).resolves.toBeUndefined();

    expect(attemptRepo.count).not.toHaveBeenCalled();
  });
});
