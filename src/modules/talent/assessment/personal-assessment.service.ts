import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorMessages, SuccessMessages } from '../../../shared';
import { UsersService } from '../../users/users.service';
import { User } from '../../users/entities/user.entity';
import { TalentProfile } from '../entities/talent-profile.entity';
import {
  PERSONAL_ASSESSMENT_SECTION_COUNT,
  PersonalAssessmentQuestion,
  SKIPPED_ONBOARDING_ANSWER_KEYS,
  getSectionQuestions,
} from './personal-assessment.schema';
import {
  assertAllSectionsComplete,
  assertOnboardingFieldsForComplete,
  getSkippedProfileValue,
  validateSectionAnswers,
} from './personal-assessment.validation';

type PersonalAssessmentStore = Record<string, unknown> & {
  _meta?: { completedSections: number[] };
};

export type TalentPersonalAssessmentContext = {
  userId: string;
  profileId: string;
  personalAssessmentCompleted: boolean;
  personalAssessmentCompletedAt: string | null;
  onboarding: {
    track: string | null;
    educationLevel: string | null;
    region: string | null;
    linkedinProfile: string | null;
    claimedLevel: string | null;
    country: string;
  };
  validatedLevel: string | null;
  answers: Record<string, unknown>;
  sections: Record<number, Record<string, unknown>>;
};

@Injectable()
export class PersonalAssessmentService {
  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepository: Repository<TalentProfile>,
    private readonly usersService: UsersService,
  ) {}

  private async findOrCreateProfile(userId: string): Promise<TalentProfile> {
    const existing = await this.talentProfileRepository.findOne({
      where: { user_id: userId },
    });
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
  ): Promise<{ status: string; message: string; section: number }> {
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

    return {
      status: 'success',
      message: SuccessMessages.ASSESSMENT.SECTION_SAVED,
      section,
    };
  }

  async complete(
    userId: string,
  ): Promise<{ status: string; message: string; completedAt: string }> {
    const profile = await this.findOrCreateProfile(userId);
    const user = await this.usersService.findOne(userId);

    if (profile.personal_assessment_completed_at) {
      throw new UnprocessableEntityException(
        ErrorMessages.ASSESSMENT.ALREADY_COMPLETED,
      );
    }

    assertOnboardingFieldsForComplete(profile, user);
    const stored = this.withoutMeta(this.readStore(profile));
    assertAllSectionsComplete(stored, profile, user);

    const completedAt = new Date();
    profile.personal_assessment_completed_at = completedAt;
    await this.talentProfileRepository.save(profile);

    return {
      status: 'success',
      message: SuccessMessages.ASSESSMENT.COMPLETED,
      completedAt: completedAt.toISOString(),
    };
  }

  private resolveAnswer(
    question: PersonalAssessmentQuestion,
    stored: Record<string, unknown>,
    profile: TalentProfile,
    user: User,
  ): unknown {
    if (question.skipStorage) {
      return getSkippedProfileValue(question, profile, user);
    }
    return stored[question.key] ?? null;
  }

  async getAiContext(userId: string): Promise<TalentPersonalAssessmentContext> {
    const profile = await this.findOrCreateProfile(userId);
    const user = await this.usersService.findOne(userId);
    const stored = this.withoutMeta(this.readStore(profile));

    const answers: Record<string, unknown> = {};
    const sections: Record<number, Record<string, unknown>> = {};

    for (let section = 1; section <= PERSONAL_ASSESSMENT_SECTION_COUNT; section++) {
      const sectionAnswers: Record<string, unknown> = {};
      for (const question of getSectionQuestions(section)) {
        const value = this.resolveAnswer(question, stored, profile, user);
        sectionAnswers[question.key] = value;
        answers[question.key] = value;

        if (question.otherTextKey) {
          const other = stored[question.otherTextKey] ?? null;
          sectionAnswers[question.otherTextKey] = other;
          answers[question.otherTextKey] = other;
        }
        if (question.followUpKey) {
          const followUp = stored[question.followUpKey] ?? null;
          sectionAnswers[question.followUpKey] = followUp;
          answers[question.followUpKey] = followUp;
        }
      }
      sections[section] = sectionAnswers;
    }

    return {
      userId,
      profileId: profile.id,
      personalAssessmentCompleted: Boolean(profile.personal_assessment_completed_at),
      personalAssessmentCompletedAt:
        profile.personal_assessment_completed_at?.toISOString() ?? null,
      onboarding: {
        track: profile.track,
        educationLevel: profile.education_level,
        region: profile.region,
        linkedinProfile: profile.linkedin_url,
        claimedLevel: profile.claimed_level,
        country: user.country,
      },
      validatedLevel: profile.validated_level,
      answers,
      sections,
    };
  }
}
