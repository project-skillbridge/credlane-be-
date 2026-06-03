import { buildPersonalAssessmentAiPromptContext } from './personal-assessment-ai-prompt-context';
import { createTestPersonalAssessmentQuestionService } from './personal-assessment-question.service';
import {
  buildFullPersonalAssessmentAnswers,
  makeTalentProfile,
  makeTalentUser,
  section1Answers,
} from './personal-assessment.test-fixtures';

describe('buildPersonalAssessmentAiPromptContext', () => {
  const catalog = createTestPersonalAssessmentQuestionService();

  it('returns a flat object with onboarding fields then answer keys', () => {
    const context = buildPersonalAssessmentAiPromptContext(
      makeTalentProfile(),
      makeTalentUser(),
      buildFullPersonalAssessmentAnswers(),
      catalog,
    );

    expect(context).not.toHaveProperty('answers');
    expect(context).not.toHaveProperty('sections');
    expect(context).not.toHaveProperty('onboarding');
    expect(context.track).toBe('frontend_developer');
    expect(context.educationLevel).toBe('bachelor');
    expect(context.skill_track).toBe('frontend_developer');
    expect(context.job_title).toBe('Software Engineer');
    expect(context.claimed_level).toBe('mid');
    expect(context.claimedLevel).toBe('mid');
  });

  it('merges section 1 stored answers with profile-backed fields', () => {
    const context = buildPersonalAssessmentAiPromptContext(
      makeTalentProfile(),
      makeTalentUser(),
      section1Answers(),
      catalog,
    );

    expect(context.job_title).toBe('Software Engineer');
    expect(context.education_level).toBe('bachelor');
    expect(context.country).toBe('Nigeria');
  });
});
