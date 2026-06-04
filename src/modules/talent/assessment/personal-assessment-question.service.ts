import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonalAssessmentQuestionEntity } from '../entities/personal-assessment-question.entity';
import { expandPersonalAssessmentImportItems } from './personal-assessment-import.expand';
import type {
  PersonalAssessmentQuestionImportItem,
  PersonalAssessmentQuestionImportResult,
} from './personal-assessment-question-import.types';
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

function mapFormatToInputType(
  format: string,
): PersonalAssessmentInputType | null {
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
      return null;
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
): PersonalAssessmentQuestion | null {
  const inputType = mapFormatToInputType(row.format);
  if (!inputType) {
    return null;
  }

  const optionItems = row.options ?? undefined;
  const question: PersonalAssessmentQuestion = {
    externalId: row.id,
    key: row.field_name,
    questionNumber: row.display_order,
    inputType,
    required: row.required,
    sectionSlug: row.section,
    prompt: row.question,
    track: normalizeTrack(row.track),
  };

  if (optionItems?.length) {
    question.optionItems = optionItems;
    question.options = optionItems.map((option) => option.value);
  }

  if (row.skip_storage) {
    question.skipStorage = true;
  }
  if (row.profile_field) {
    question.profileField =
      row.profile_field as PersonalAssessmentQuestion['profileField'];
  }
  if (row.min_length != null) {
    question.minLength = row.min_length;
  }
  if (row.max_length != null) {
    question.maxLength = row.max_length;
  }
  if (row.other_text_key) {
    question.otherTextKey = row.other_text_key;
  }
  if (row.follow_up_key) {
    question.followUpKey = row.follow_up_key;
  }
  if (row.follow_up_when) {
    question.followUpWhen = row.follow_up_when;
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
      rows.flatMap((row) => {
        const sectionNumber = resolveSectionNumber(row.section);
        const question = toPersonalAssessmentQuestion(row);
        if (!question) {
          this.logger.warn(
            `Skipping personal assessment question "${row.id}" with unsupported format "${row.format}"`,
          );
          return [];
        }
        return [{ section: sectionNumber, question }];
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

      const trackQuestions = this.allQuestionsByTrack.get(track) ?? [];
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
    return (
      this.keyToSectionByTrack
        .get(PERSONAL_ASSESSMENT_GLOBAL_TRACK)
        ?.get(key) ?? 0
    );
  }

  getSectionCount(): number {
    return PERSONAL_ASSESSMENT_SECTION_COUNT;
  }

  async importQuestions(
    items: PersonalAssessmentQuestionImportItem[],
  ): Promise<PersonalAssessmentQuestionImportResult> {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of items) {
      let rows;
      try {
        rows = expandPersonalAssessmentImportItems(item);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${item.id}: ${msg}`);
        skipped++;
        continue;
      }
      if (rows.length === 0) {
        errors.push(
          `${item.id}: no rows produced for format "${item.format}" (field "${item.fieldName}"); provide options or track_variants for select questions`,
        );
        skipped++;
        continue;
      }
      for (const row of rows) {
        try {
          const existing = await this.questionRepo.findOne({
            where: { id: row.id },
          });
          const payload = {
            section: row.section,
            track: row.track,
            question: row.question,
            field_name: row.fieldName,
            format: row.format,
            required: row.required,
            options: row.options,
          };
          if (existing) {
            await this.questionRepo.update(row.id, payload);
            updated++;
          } else {
            await this.questionRepo.save(
              this.questionRepo.create({
                id: row.id,
                ...payload,
                is_live: true,
              }),
            );
            inserted++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${row.id}: ${msg}`);
          skipped++;
        }
      }
    }

    await this.reloadFromDatabase();
    return { inserted, updated, skipped, errors };
  }
}

export function createTestPersonalAssessmentQuestionService(): PersonalAssessmentQuestionService {
  const service = new PersonalAssessmentQuestionService(
    {} as Repository<PersonalAssessmentQuestionEntity>,
  );
  service.loadFromTestQuestions();
  return service;
}
