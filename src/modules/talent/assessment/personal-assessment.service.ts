import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { ErrorMessages, SuccessMessages } from '../../../shared';
import { camelToSnake } from '../../../common/utils/case-transform';
import { personalAssessmentGenerationSchema } from '../../ai/ai.schemas';
import { OpenRouterService } from '../../ai/openrouter.service';
import { UsersService } from '../../users/users.service';
import { TALENT_CLAIMED_LEVELS } from '../talent.constants';
import { TalentProfile } from '../entities/talent-profile.entity';
import {
  ONBOARDING_TRACK_TO_ASSESSMENT_TRACK,
  PERSONAL_ASSESSMENT_SECTION_COUNT,
  PERSONAL_ASSESSMENT_SECTIONS,
  PERSONAL_ASSESSMENT_SECTION_TITLES,
  PersonalAssessmentInputType,
  PersonalAssessmentQuestion,
  SKIPPED_ONBOARDING_ANSWER_KEYS,
  SPECIALIZATIONS_BY_TRACK,
  TOOLS_BY_TRACK,
  getAllPersonalAssessmentQuestions,
} from './personal-assessment.schema';
import {
  buildPersonalAssessmentAiPromptContext,
  type PersonalAssessmentAiPromptContextPayload,
} from './personal-assessment-ai-prompt-context';
import {
  getPersonalAssessmentProgress,
  type PersonalAssessmentResumeProgress,
} from './personal-assessment.progress';
import {
  assertOnboardingFieldsForComplete,
  validateGeneratedPersonalAssessmentAnswers,
  validateSectionAnswers,
} from './personal-assessment.validation';

const GENERATED_PERSONAL_ASSESSMENT_MIN_QUESTIONS = 15;
const GENERATED_PERSONAL_ASSESSMENT_MAX_QUESTIONS = 20;
const GENERATED_PERSONAL_ASSESSMENT_REQUIRED_KEYS = ['claimed_level'];
const COMPLETED_PERSONAL_ASSESSMENT_SECTIONS = Array.from(
  { length: PERSONAL_ASSESSMENT_SECTION_COUNT },
  (_ignored, index) => index + 1,
);

export type GeneratedPersonalAssessmentQuestion = {
  id: string;
  key: string;
  sourceQuestionNumber: number;
  sourceSection: number;
  sourceSectionTitle: string;
  inputType: PersonalAssessmentInputType;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  prompt: string;
  helperText: string | null;
  options?: readonly string[];
  otherTextKey?: string;
  followUpKey?: string;
  followUpWhen?: string;
};

export type GeneratedPersonalAssessmentSession = {
  sessionId: string;
  generatedAt: string;
  source: 'ai' | 'fallback';
  track: string | null;
  claimedLevel: string | null;
  questionCount: number;
  questions: GeneratedPersonalAssessmentQuestion[];
};

type PersonalAssessmentStore = Record<string, unknown> & {
  _meta?: {
    completedSections?: number[];
    generatedSession?: GeneratedPersonalAssessmentSession;
  };
};

/** Flat AI Prompt Chain payload returned by GET .../context. */
export type TalentPersonalAssessmentContext =
  PersonalAssessmentAiPromptContextPayload;

@Injectable()
export class PersonalAssessmentService {
  private readonly logger = new Logger(PersonalAssessmentService.name);

  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepository: Repository<TalentProfile>,
    private readonly usersService: UsersService,
    @Optional() private readonly openRouter?: OpenRouterService,
  ) {}

  private findProfileByUserId(userId: string): Promise<TalentProfile | null> {
    return this.talentProfileRepository.findOne({
      where: { user_id: userId },
    });
  }

  /** Blocks retaking or rewriting a finished personal assessment (legacy section flow). */
  private assertPersonalAssessmentNotRetakable(
    profile: TalentProfile,
    store: PersonalAssessmentStore,
  ): void {
    if (
      profile.personal_assessment_completed_at ||
      getPersonalAssessmentProgress(store._meta).isComplete
    ) {
      throw new UnprocessableEntityException(
        ErrorMessages.ASSESSMENT.ALREADY_COMPLETED,
      );
    }
  }

  private async findOrCreateProfile(userId: string): Promise<TalentProfile> {
    const existing = await this.findProfileByUserId(userId);
    if (existing) {
      return existing;
    }

    return this.talentProfileRepository.save(
      this.talentProfileRepository.create({ user_id: userId }),
    );
  }

  private readStore(profile: TalentProfile): PersonalAssessmentStore {
    const raw = profile.personal_assessment_answers;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }
    return { ...(raw as PersonalAssessmentStore) };
  }

  private withoutMeta(store: PersonalAssessmentStore): Record<string, unknown> {
    const { _meta: _ignored, ...answers } = store;
    return answers;
  }

  private resolveGeneratedAnswers(
    answers: Record<string, unknown>,
    profile: TalentProfile,
  ): Record<string, unknown> {
    const claimedLevel = answers.claimed_level ?? profile.claimed_level;

    if (claimedLevel === undefined || claimedLevel === null) {
      return answers;
    }

    return {
      ...answers,
      claimed_level: claimedLevel,
    };
  }

  private async persistGeneratedAssessmentCompletion(
    manager: EntityManager,
    profile: TalentProfile,
    store: PersonalAssessmentStore,
    validated: Record<string, unknown>,
  ): Promise<Date> {
    const completedAt = new Date();

    profile.personal_assessment_answers = {
      ...this.withoutMeta(store),
      ...validated,
      _meta: {
        ...store._meta,
        completedSections: COMPLETED_PERSONAL_ASSESSMENT_SECTIONS,
      },
    };

    if (typeof validated.claimed_level === 'string') {
      profile.claimed_level =
        validated.claimed_level as TalentProfile['claimed_level'];
    }

    profile.personal_assessment_completed_at = completedAt;
    await manager.save(TalentProfile, profile);

    return completedAt;
  }

  private withSectionSaved(
    store: PersonalAssessmentStore,
    section: number,
    validated: Record<string, unknown>,
  ): PersonalAssessmentStore {
    const completedSections = new Set(store._meta?.completedSections ?? []);
    completedSections.add(section);

    return {
      ...this.withoutMeta(store),
      ...validated,
      _meta: {
        ...store._meta,
        completedSections: [...completedSections].sort((a, b) => a - b),
      },
    };
  }

  private normalizeAnswerAliases(
    rawAnswers: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};
    const sourceKeys: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawAnswers)) {
      const snakeKey = key.includes('_') ? key : camelToSnake(key);
      if (snakeKey in normalized && sourceKeys[snakeKey] !== key) {
        throw new BadRequestException(
          `Conflicting answer aliases: "${sourceKeys[snakeKey]}" and "${key}" both map to "${snakeKey}"`,
        );
      }
      normalized[snakeKey] = value;
      sourceKeys[snakeKey] = key;
    }
    return normalized;
  }

  async startGenerated(userId: string): Promise<{
    status: string;
    message: string;
    session: GeneratedPersonalAssessmentSession;
  }> {
    const user = await this.usersService.findOne(userId);
    const profile = await this.findOrCreateProfile(userId);

    if (profile.personal_assessment_completed_at) {
      throw new UnprocessableEntityException(
        ErrorMessages.ASSESSMENT.ALREADY_COMPLETED,
      );
    }

    assertOnboardingFieldsForComplete(profile);

    const session = await this.generatePersonalAssessmentSession(profile, user);
    const store = this.readStore(profile);

    profile.personal_assessment_answers = {
      ...this.withoutMeta(store),
      _meta: {
        ...store._meta,
        generatedSession: session,
      },
    };
    await this.talentProfileRepository.save(profile);

    return {
      status: 'success',
      message: 'Personal assessment generated',
      session,
    };
  }

  async getGeneratedSession(userId: string): Promise<{
    status: string;
    session: GeneratedPersonalAssessmentSession | null;
    answers: Record<string, unknown>;
  }> {
    const profile = await this.findProfileByUserId(userId);
    const store = profile ? this.readStore(profile) : {};

    return {
      status: 'success',
      session: store._meta?.generatedSession ?? null,
      answers: this.withoutMeta(store),
    };
  }

  async submitGenerated(
    userId: string,
    rawAnswers: Record<string, unknown>,
  ): Promise<{ status: string; message: string; completedAt: string }> {
    const completedAt = await this.talentProfileRepository.manager.transaction(
      async (manager) => {
        let profile = await manager.findOne(TalentProfile, {
          where: { user_id: userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!profile) {
          profile = await manager.save(
            manager.create(TalentProfile, { user_id: userId }),
          );
        }

        if (profile.personal_assessment_completed_at) {
          throw new UnprocessableEntityException(
            ErrorMessages.ASSESSMENT.ALREADY_COMPLETED,
          );
        }

        assertOnboardingFieldsForComplete(profile);

        const store = this.readStore(profile);
        const session = store._meta?.generatedSession;
        if (!session) {
          throw new UnprocessableEntityException({
            message:
              'Generate a personal assessment session before submitting answers',
          });
        }

        const sourceQuestions = this.resolveGeneratedSourceQuestions(session);
        const normalizedAnswers = this.normalizeAnswerAliases(rawAnswers);
        const filtered = Object.fromEntries(
          Object.entries(normalizedAnswers).filter(
            ([key]) =>
              !SKIPPED_ONBOARDING_ANSWER_KEYS.has(key) ||
              key === 'claimed_level',
          ),
        );
        const submissionAnswers = this.resolveGeneratedAnswers(
          filtered,
          profile,
        );
        const validated = validateGeneratedPersonalAssessmentAnswers(
          sourceQuestions,
          submissionAnswers,
          profile,
        );

        const completedAt = await this.persistGeneratedAssessmentCompletion(
          manager,
          profile,
          store,
          validated,
        );

        return completedAt;
      },
    );

    return {
      status: 'success',
      message: SuccessMessages.ASSESSMENT.COMPLETED,
      completedAt: completedAt.toISOString(),
    };
  }

  private async generatePersonalAssessmentSession(
    profile: TalentProfile,
    user: Awaited<ReturnType<UsersService['findOne']>>,
  ): Promise<GeneratedPersonalAssessmentSession> {
    const sourceQuestions = this.personalAssessmentGenerationBank(profile);
    const aiSelection = await this.tryGeneratePersonalAssessment(profile, user);
    const questionMap = new Map(
      sourceQuestions.map((question) => [question.key, question]),
    );
    const selected: Array<{
      question: PersonalAssessmentQuestion;
      prompt: string;
      helperText: string | null;
    }> = [];
    const seen = new Set<string>();

    for (const generated of aiSelection.questions) {
      const source = questionMap.get(generated.source_key);
      if (!source || seen.has(source.key)) {
        continue;
      }
      seen.add(source.key);
      selected.push({
        question: source,
        prompt: generated.prompt,
        helperText: generated.helper_text,
      });
    }

    for (const requiredKey of GENERATED_PERSONAL_ASSESSMENT_REQUIRED_KEYS) {
      const requiredQuestion = questionMap.get(requiredKey);
      if (!requiredQuestion || seen.has(requiredQuestion.key)) {
        continue;
      }
      seen.add(requiredQuestion.key);
      selected.push({
        question: requiredQuestion,
        prompt: this.defaultQuestionPrompt(requiredQuestion),
        helperText: null,
      });
    }

    for (const fallback of this.fallbackPersonalAssessmentQuestions(profile)) {
      if (selected.length >= GENERATED_PERSONAL_ASSESSMENT_MIN_QUESTIONS) {
        break;
      }
      if (seen.has(fallback.key)) {
        continue;
      }
      seen.add(fallback.key);
      selected.push({
        question: fallback,
        prompt: this.defaultQuestionPrompt(fallback),
        helperText: null,
      });
    }

    const questions = selected
      .slice(0, GENERATED_PERSONAL_ASSESSMENT_MAX_QUESTIONS)
      .map(({ question, prompt, helperText }) =>
        this.toGeneratedPersonalQuestion(question, prompt, helperText, profile),
      )
      .sort(
        (a, b) =>
          a.sourceSection - b.sourceSection ||
          a.sourceQuestionNumber - b.sourceQuestionNumber,
      );

    return {
      sessionId: randomUUID(),
      generatedAt: new Date().toISOString(),
      source:
        aiSelection.source === 'ai' &&
        questions.length >= GENERATED_PERSONAL_ASSESSMENT_MIN_QUESTIONS
          ? 'ai'
          : 'fallback',
      track: profile.track ?? null,
      claimedLevel: profile.claimed_level ?? null,
      questionCount: questions.length,
      questions,
    };
  }

  private async tryGeneratePersonalAssessment(
    profile: TalentProfile,
    user: Awaited<ReturnType<UsersService['findOne']>>,
  ): Promise<{
    source: 'ai' | 'fallback';
    questions: Array<{
      source_key: string;
      prompt: string;
      helper_text: string | null;
    }>;
  }> {
    if (!this.openRouter) {
      return { source: 'fallback', questions: [] };
    }

    try {
      const result = await this.openRouter.chat(
        [
          'You are a senior talent assessor generating a focused personal assessment form.',
          'Use the provided 48-question framework as the source payload.',
          'Generate role-aware questions for the candidate based on their selected role, goal, level, and onboarding context.',
          'Return only valid JSON.',
        ].join(' '),
        this.buildPersonalAssessmentGenerationPrompt(profile, user),
        personalAssessmentGenerationSchema,
        0.5,
      );
      return { source: 'ai', questions: result.questions };
    } catch (error) {
      this.logger.warn(
        `Personal assessment generation fell back to deterministic questions: ${String(error)}`,
      );
      return { source: 'fallback', questions: [] };
    }
  }

  private buildPersonalAssessmentGenerationPrompt(
    profile: TalentProfile,
    user: Awaited<ReturnType<UsersService['findOne']>>,
  ): string {
    const bank = this.personalAssessmentGenerationBank(profile).map(
      (question) => ({
        source_key: question.key,
        section: this.findQuestionSection(question.key),
        question_number: question.questionNumber,
        input_type: question.inputType,
        required: question.required,
        base_prompt: this.defaultQuestionPrompt(question),
        options: this.resolveQuestionOptions(question, profile) ?? null,
        min_length: question.minLength ?? null,
        max_length: question.maxLength ?? null,
      }),
    );

    return JSON.stringify({
      instruction:
        'Generate a personal assessment with 15 to 20 questions. Use the 48-question question_bank as context and source material, then pick the best source questions for this candidate role. Preserve each selected source_key exactly so the frontend answer payload can be validated. Rewrite prompt in a natural candidate-facing voice for the candidate role and claimed level. Include a mix of single-pick, multi-pick, and written-answer questions; written-answer questions are any source question whose input_type is text_required or text_optional. Do not invent new answer keys, input types, or option values.',
      candidate: {
        track: profile.track,
        claimed_level: profile.claimed_level,
        goal: profile.goal,
        region: profile.region,
        education_level: profile.education_level,
        country: user.country,
      },
      rules: {
        min_questions: GENERATED_PERSONAL_ASSESSMENT_MIN_QUESTIONS,
        max_questions: GENERATED_PERSONAL_ASSESSMENT_MAX_QUESTIONS,
        required_source_keys: GENERATED_PERSONAL_ASSESSMENT_REQUIRED_KEYS,
        use_question_bank_as_context_payload: true,
        preserve_source_keys: true,
        include_written_answers: true,
        written_input_types: ['text_required', 'text_optional'],
        include_background: true,
        include_skills: true,
        include_work_style: true,
        include_availability: true,
      },
      question_bank: bank,
      response_schema: {
        questions: [
          {
            source_key: 'one source_key from question_bank',
            input_type: 'preserve exactly from question_bank (single|multi|text_required|text_optional)',
            prompt: 'candidate-facing question text',
            helper_text: 'short optional hint or null',
          },
        ],
      },
    });
  }

  private personalAssessmentGenerationBank(
    profile: TalentProfile,
  ): PersonalAssessmentQuestion[] {
    return getAllPersonalAssessmentQuestions().filter((question) => {
      if (question.skipStorage && question.key !== 'claimed_level') {
        return false;
      }

      const options = this.resolveQuestionOptions(question, profile);
      if (
        (question.key === 'specialization' || question.key === 'tools') &&
        (!options || options.length === 0)
      ) {
        return false;
      }

      return true;
    });
  }

  private fallbackPersonalAssessmentQuestions(
    profile: TalentProfile,
  ): PersonalAssessmentQuestion[] {
    const bank = this.personalAssessmentGenerationBank(profile);
    const priority = [
      'job_title',
      'years_experience',
      'industries',
      'claimed_level',
      'specialization',
      'tools',
      'primary_tool_duration',
      'shipped_deliverable',
      'managed_team',
      'difficult_decision_narrative',
      'led_project_unsupervised',
      'international_org_experience',
      'remote_experience',
      'work_arrangement_preference',
      'deadline_handling',
      'ideal_work_environment',
      'proudest_achievement',
      'job_search_status',
      'availability',
      'engagement_types',
      'next_role_narrative',
    ];
    const byKey = new Map(bank.map((question) => [question.key, question]));

    return [
      ...priority
        .map((key) => byKey.get(key))
        .filter((question): question is PersonalAssessmentQuestion =>
          Boolean(question),
        ),
      ...bank.filter((question) => !priority.includes(question.key)),
    ];
  }

  private resolveGeneratedSourceQuestions(
    session: GeneratedPersonalAssessmentSession,
  ): PersonalAssessmentQuestion[] {
    const byKey = new Map(
      getAllPersonalAssessmentQuestions().map((question) => [
        question.key,
        question,
      ]),
    );

    return session.questions
      .map((question) => byKey.get(question.key))
      .filter((question): question is PersonalAssessmentQuestion =>
        Boolean(question),
      );
  }

  private toGeneratedPersonalQuestion(
    question: PersonalAssessmentQuestion,
    prompt: string,
    helperText: string | null,
    profile: TalentProfile,
  ): GeneratedPersonalAssessmentQuestion {
    const options = this.resolveQuestionOptions(question, profile);
    const sourceSection = this.findQuestionSection(question.key);
    return {
      id: randomUUID(),
      key: question.key,
      sourceQuestionNumber: question.questionNumber,
      sourceSection,
      sourceSectionTitle: this.sectionTitle(sourceSection),
      inputType: question.inputType,
      required: question.required,
      ...(question.minLength !== undefined && {
        minLength: question.minLength,
      }),
      ...(question.maxLength !== undefined && {
        maxLength: question.maxLength,
      }),
      prompt,
      helperText,
      ...(options && { options }),
      ...(question.otherTextKey && { otherTextKey: question.otherTextKey }),
      ...(question.followUpKey && { followUpKey: question.followUpKey }),
      ...(question.followUpWhen && { followUpWhen: question.followUpWhen }),
    };
  }

  private resolveQuestionOptions(
    question: PersonalAssessmentQuestion,
    profile: TalentProfile,
  ): readonly string[] | undefined {
    if (question.key === 'specialization') {
      const track = profile.track
        ? ONBOARDING_TRACK_TO_ASSESSMENT_TRACK[profile.track]
        : null;
      return track ? SPECIALIZATIONS_BY_TRACK[track] : undefined;
    }
    if (question.key === 'tools') {
      const track = profile.track
        ? ONBOARDING_TRACK_TO_ASSESSMENT_TRACK[profile.track]
        : null;
      return track ? TOOLS_BY_TRACK[track] : undefined;
    }
    if (question.key === 'claimed_level') {
      return TALENT_CLAIMED_LEVELS;
    }
    return question.options;
  }

  private findQuestionSection(key: string): number {
    for (
      let section = 1;
      section <= PERSONAL_ASSESSMENT_SECTION_COUNT;
      section++
    ) {
      if (
        PERSONAL_ASSESSMENT_SECTIONS[section].some(
          (question) => question.key === key,
        )
      ) {
        return section;
      }
    }
    return 0;
  }

  private sectionTitle(section: number): string {
    return PERSONAL_ASSESSMENT_SECTION_TITLES[section] ?? 'Personal Assessment';
  }

  private defaultQuestionPrompt(question: PersonalAssessmentQuestion): string {
    return question.key
      .split('_')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ');
  }

  async saveSection(
    userId: string,
    section: number,
    rawAnswers: Record<string, unknown>,
  ): Promise<{
    status: string;
    message: string;
    section: number;
    progress: PersonalAssessmentResumeProgress;
  }> {
    if (
      !Number.isInteger(section) ||
      section < 1 ||
      section > PERSONAL_ASSESSMENT_SECTION_COUNT
    ) {
      throw new BadRequestException(ErrorMessages.ASSESSMENT.INVALID_SECTION);
    }

    const normalizedAnswers = this.normalizeAnswerAliases(rawAnswers);
    const filtered = Object.fromEntries(
      Object.entries(normalizedAnswers).filter(
        ([key]) => !SKIPPED_ONBOARDING_ANSWER_KEYS.has(key),
      ),
    );

    await this.talentProfileRepository.manager.transaction(async (manager) => {
      let profile = await manager.findOne(TalentProfile, {
        where: { user_id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!profile) {
        profile = await manager.save(
          manager.create(TalentProfile, { user_id: userId }),
        );
      }

      this.assertPersonalAssessmentNotRetakable(
        profile,
        this.readStore(profile),
      );

      const validated = validateSectionAnswers(section, filtered, profile);
      if (typeof validated.claimed_level === 'string') {
        profile.claimed_level =
          validated.claimed_level as TalentProfile['claimed_level'];
      }
      profile.personal_assessment_answers = this.withSectionSaved(
        this.readStore(profile),
        section,
        validated,
      );
      await manager.save(TalentProfile, profile);
    });

    const profile = await this.findOrCreateProfile(userId);
    const store = this.readStore(profile);

    return {
      status: 'success',
      message: SuccessMessages.ASSESSMENT.SECTION_SAVED,
      section,
      progress: getPersonalAssessmentProgress(store._meta),
    };
  }

  async complete(
    userId: string,
  ): Promise<{ status: string; message: string; completedAt: string }> {
    const completedAt = await this.talentProfileRepository.manager.transaction(
      async (manager) => {
        let profile = await manager.findOne(TalentProfile, {
          where: { user_id: userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!profile) {
          profile = await manager.save(
            manager.create(TalentProfile, { user_id: userId }),
          );
        }

        if (profile.personal_assessment_completed_at) {
          throw new UnprocessableEntityException(
            ErrorMessages.ASSESSMENT.ALREADY_COMPLETED,
          );
        }

        assertOnboardingFieldsForComplete(profile);
        const store = this.readStore(profile);
        const session = store._meta?.generatedSession;
        if (!session) {
          throw new UnprocessableEntityException({
            message:
              'Generate a personal assessment session before submitting answers',
          });
        }

        const sourceQuestions = this.resolveGeneratedSourceQuestions(session);
        const completionAnswers = this.resolveGeneratedAnswers(
          this.withoutMeta(store),
          profile,
        );
        const validated = validateGeneratedPersonalAssessmentAnswers(
          sourceQuestions,
          completionAnswers,
          profile,
        );

        const completedAt = await this.persistGeneratedAssessmentCompletion(
          manager,
          profile,
          store,
          validated,
        );

        return completedAt;
      },
    );

    return {
      status: 'success',
      message: SuccessMessages.ASSESSMENT.COMPLETED,
      completedAt: completedAt.toISOString(),
    };
  }

  async getResumeProgress(userId: string): Promise<{
    personalAssessmentCompleted: boolean;
    personalAssessmentCompletedAt: string | null;
    progress: PersonalAssessmentResumeProgress;
  }> {
    const profile = await this.findProfileByUserId(userId);
    const store = profile ? this.readStore(profile) : {};

    return {
      personalAssessmentCompleted: Boolean(
        profile?.personal_assessment_completed_at,
      ),
      personalAssessmentCompletedAt:
        profile?.personal_assessment_completed_at?.toISOString() ?? null,
      progress: getPersonalAssessmentProgress(store._meta),
    };
  }

  async getAiContext(userId: string): Promise<TalentPersonalAssessmentContext> {
    const user = await this.usersService.findOne(userId);
    const profile = await this.findProfileByUserId(userId);
    const emptyProfile = Object.assign(new TalentProfile(), {
      user_id: userId,
    });

    return buildPersonalAssessmentAiPromptContext(
      profile ?? emptyProfile,
      user,
      profile ? this.withoutMeta(this.readStore(profile)) : {},
    );
  }
}
