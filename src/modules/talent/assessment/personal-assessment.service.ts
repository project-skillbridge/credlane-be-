import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorMessages, SuccessMessages } from '../../../shared';
import { UsersService } from '../../users/users.service';
import { TalentProfile } from '../entities/talent-profile.entity';
import { PERSONAL_ASSESSMENT_SECTION_COUNT, SKIPPED_ONBOARDING_ANSWER_KEYS } from './personal-assessment.schema';
import {
  buildPersonalAssessmentAiPromptContext,
  type PersonalAssessmentAiPromptContextPayload,
} from './personal-assessment-ai-prompt-context';
import {
  getPersonalAssessmentProgress,
  readCompletedSections,
  type PersonalAssessmentResumeProgress,
} from './personal-assessment.progress';
import {
  assertAssessmentReadyForComplete,
  assertOnboardingFieldsForComplete,
  validateSectionAnswers,
} from './personal-assessment.validation';

type PersonalAssessmentStore = Record<string, unknown> & {
  _meta?: { completedSections: number[] };
};

/** Flat AI Prompt Chain payload returned by GET .../context. */
export type TalentPersonalAssessmentContext = PersonalAssessmentAiPromptContextPayload;

@Injectable()
export class PersonalAssessmentService {
  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepository: Repository<TalentProfile>,
    private readonly usersService: UsersService,
  ) {}

  private findProfileByUserId(userId: string): Promise<TalentProfile | null> {
    return this.talentProfileRepository.findOne({
      where: { user_id: userId },
    });
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
      _meta: { completedSections: [...completedSections].sort((a, b) => a - b) },
    };
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

    const filtered = Object.fromEntries(
      Object.entries(rawAnswers).filter(
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

      const validated = validateSectionAnswers(section, filtered, profile);
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
    const user = await this.usersService.findOne(userId);

    const completedAt =
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

        if (profile.personal_assessment_completed_at) {
          throw new UnprocessableEntityException(
            ErrorMessages.ASSESSMENT.ALREADY_COMPLETED,
          );
        }

        assertOnboardingFieldsForComplete(profile, user);
        const store = this.readStore(profile);
        const stored = this.withoutMeta(store);
        const completedSections = readCompletedSections(store._meta);
        assertAssessmentReadyForComplete(
          stored,
          completedSections,
          profile,
          user,
        );

        const completedAt = new Date();
        profile.personal_assessment_completed_at = completedAt;
        await manager.save(TalentProfile, profile);

        return completedAt;
      });

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
    const emptyProfile = Object.assign(new TalentProfile(), { user_id: userId });

    return buildPersonalAssessmentAiPromptContext(
      profile ?? emptyProfile,
      user,
      profile ? this.withoutMeta(this.readStore(profile)) : {},
    );
  }
}
