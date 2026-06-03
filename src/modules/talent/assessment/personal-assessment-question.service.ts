import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonalAssessmentQuestionEntity } from '../entities/personal-assessment-question.entity';
import {
  PERSONAL_ASSESSMENT_SECTION_COUNT,
  PERSONAL_ASSESSMENT_SECTION_SLUG_TO_NUMBER,
  type PersonalAssessmentInputType,
  type PersonalAssessmentQuestion,
} from './personal-assessment.schema';
import { PERSONAL_ASSESSMENT_TEST_QUESTIONS } from './personal-assessment.test-questions';

export const PERSONAL_ASSESSMENT_GLOBAL_TRACK = 'all';

export type PersonalAssessmentQuestionCatalog = {
  getSectionQuestions(
    section: number,
    track?: string | null,
  ): PersonalAssessmentQuestion[];
  getAllQuestions(track?: string | null): PersonalAssessmentQuestion[];
  getOnboardingBackedQuestionKeys(track?: string | null): readonly string[];
  findQuestionSection(key: string, track?: string | null): number;
};

function mapFormatToInputType(format: string): PersonalAssessmentInputType {
  switch (format) {
    case 'single_select':
      return 'single';
    case 'multi_select':
      return 'multi';
    case 'text_required':
      return 'text_required';
    case 'text_optional':
      return 'text_optional';
    default:
      return format as PersonalAssessmentInputType;
  }
}

function resolveSectionNumber(sectionSlug: string): number {
  return PERSONAL_ASSESSMENT_SECTION_SLUG_TO_NUMBER[sectionSlug] ?? 0;
}

function normalizeTrack(track?: string | null): string {
  const trimmed = track?.trim();
  return trimmed && trimmed.length > 0
    ? trimmed
    : PERSONAL_ASSESSMENT_GLOBAL_TRACK;
}

function resolveTracksForLookup(track?: string | null): string[] {
  const normalized = normalizeTrack(track);
  if (normalized === PERSONAL_ASSESSMENT_GLOBAL_TRACK) {
    return [PERSONAL_ASSESSMENT_GLOBAL_TRACK];
  }
  return [PERSONAL_ASSESSMENT_GLOBAL_TRACK, normalized];
}

function toPersonalAssessmentQuestion(
  row: PersonalAssessmentQuestionEntity,
): PersonalAssessmentQuestion {
  const optionItems = row.options ?? undefined;
  const question: PersonalAssessmentQuestion = {
    externalId: row.id,
    key: row.field_name,
    questionNumber: row.display_order,
    inputType: mapFormatToInputType(row.format),
    required: row.required,
    sectionSlug: row.section,
    prompt: row.question,
    track: normalizeTrack(row.track),
  };

  if (optionItems?.length) {
    question.optionItems = optionItems;
    question.options = optionItems.map((option) => option.value);
  }

  return question;
}

@Injectable()
export class PersonalAssessmentQuestionService
  implements OnModuleInit, PersonalAssessmentQuestionCatalog
{
  private readonly logger = new Logger(PersonalAssessmentQuestionService.name);
  private byTrackSection = new Map<
    string,
    Map<number, PersonalAssessmentQuestion[]>
  >();
  private keyToSectionByTrack = new Map<string, Map<string, number>>();
  private allQuestionsByTrack = new Map<string, PersonalAssessmentQuestion[]>();
  private ready = false;

  constructor(
    @InjectRepository(PersonalAssessmentQuestionEntity)
    private readonly questionRepo: Repository<PersonalAssessmentQuestionEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reloadFromDatabase();
  }

  async reloadFromDatabase(): Promise<void> {
    const rows = await this.questionRepo.find({
      where: { is_live: true },
      order: { section: 'ASC', display_order: 'ASC', id: 'ASC' },
    });

    if (rows.length === 0) {
      this.logger.warn('Personal assessment question bank is empty');
      this.indexRows([]);
      return;
    }

    this.indexRows(
      rows.map((row) => {
        const sectionNumber = resolveSectionNumber(row.section);
        return {
          section: sectionNumber,
          question: toPersonalAssessmentQuestion(row),
        };
      }),
    );
  }

  /** Loads the in-memory catalog for unit/e2e tests. */
  loadFromTestQuestions(): void {
    this.indexRows(
      PERSONAL_ASSESSMENT_TEST_QUESTIONS.map((question) => ({
        section: resolveSectionNumber(question.sectionSlug),
        question,
      })),
    );
  }

  private indexRows(
    entries: Array<{ section: number; question: PersonalAssessmentQuestion }>,
  ): void {
    this.byTrackSection.clear();
    this.keyToSectionByTrack.clear();
    this.allQuestionsByTrack.clear();

    for (const { section, question } of entries) {
      if (section <= 0) {
        this.logger.warn(
          `Skipping personal assessment question "${question.key}" with unknown section slug "${question.sectionSlug ?? 'unknown'}"`,
        );
        continue;
      }

      const track = normalizeTrack(question.track);
      const sectionMap =
        this.byTrackSection.get(track) ??
        new Map<number, PersonalAssessmentQuestion[]>();
      const sectionQuestions = sectionMap.get(section) ?? [];
      sectionQuestions.push(question);
      sectionMap.set(section, sectionQuestions);
      this.byTrackSection.set(track, sectionMap);

      const keyMap =
        this.keyToSectionByTrack.get(track) ?? new Map<string, number>();
      keyMap.set(question.key, section);
      this.keyToSectionByTrack.set(track, keyMap);

      const trackQuestions =
        this.allQuestionsByTrack.get(track) ?? [];
      trackQuestions.push(question);
      this.allQuestionsByTrack.set(track, trackQuestions);
    }

    this.ready = true;
  }

  private assertReady(): void {
    if (!this.ready) {
      throw new ServiceUnavailableException(
        'Personal assessment questions are not loaded',
      );
    }
  }

  getSectionQuestions(
    section: number,
    track?: string | null,
  ): PersonalAssessmentQuestion[] {
    this.assertReady();
    const merged = new Map<string, PersonalAssessmentQuestion>();
    for (const trackKey of resolveTracksForLookup(track)) {
      for (const question of this.byTrackSection.get(trackKey)?.get(section) ??
        []) {
        merged.set(question.key, question);
      }
    }
    return [...merged.values()];
  }

  getAllQuestions(track?: string | null): PersonalAssessmentQuestion[] {
    this.assertReady();
    const merged = new Map<string, PersonalAssessmentQuestion>();
    for (const trackKey of resolveTracksForLookup(track)) {
      for (const question of this.allQuestionsByTrack.get(trackKey) ?? []) {
        merged.set(question.key, question);
      }
    }
    return [...merged.values()];
  }

  getOnboardingBackedQuestionKeys(track?: string | null): readonly string[] {
    return this.getAllQuestions(track)
      .filter((question) => question.skipStorage)
      .map((question) => question.key);
  }

  findQuestionSection(key: string, track?: string | null): number {
    this.assertReady();
    const normalized = normalizeTrack(track);
    if (normalized !== PERSONAL_ASSESSMENT_GLOBAL_TRACK) {
      const trackSection = this.keyToSectionByTrack.get(normalized)?.get(key);
      if (trackSection) {
        return trackSection;
      }
    }
    return this.keyToSectionByTrack.get(PERSONAL_ASSESSMENT_GLOBAL_TRACK)?.get(key) ?? 0;
  }

  getSectionCount(): number {
    return PERSONAL_ASSESSMENT_SECTION_COUNT;
  }
}

export function createTestPersonalAssessmentQuestionService(): PersonalAssessmentQuestionService {
  const service = new PersonalAssessmentQuestionService(
    {} as Repository<PersonalAssessmentQuestionEntity>,
  );
  service.loadFromTestQuestions();
  return service;
}
