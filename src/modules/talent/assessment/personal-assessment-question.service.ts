import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PersonalAssessmentQuestionEntity,
} from '../entities/personal-assessment-question.entity';
import {
  PERSONAL_ASSESSMENT_SECTION_COUNT,
  PERSONAL_ASSESSMENT_SECTION_SLUG_TO_NUMBER,
  type PersonalAssessmentInputType,
  type PersonalAssessmentQuestion,
} from './personal-assessment.schema';
import { PERSONAL_ASSESSMENT_TEST_QUESTIONS } from './personal-assessment.test-questions';

export type PersonalAssessmentQuestionCatalog = {
  getSectionQuestions(section: number): PersonalAssessmentQuestion[];
  getAllQuestions(): PersonalAssessmentQuestion[];
  getOnboardingBackedQuestionKeys(): readonly string[];
  findQuestionSection(key: string): number;
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
    track: row.track,
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
  private bySection = new Map<number, PersonalAssessmentQuestion[]>();
  private keyToSection = new Map<string, number>();
  private allQuestions: PersonalAssessmentQuestion[] = [];
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
    this.bySection.clear();
    this.keyToSection.clear();
    this.allQuestions = [];

    for (const { section, question } of entries) {
      if (section <= 0) {
        this.logger.warn(
          `Skipping personal assessment question "${question.key}" with unknown section slug "${question.sectionSlug ?? 'unknown'}"`,
        );
        continue;
      }

      this.keyToSection.set(question.key, section);
      const sectionQuestions = this.bySection.get(section) ?? [];
      sectionQuestions.push(question);
      this.bySection.set(section, sectionQuestions);
      this.allQuestions.push(question);
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

  getSectionQuestions(section: number): PersonalAssessmentQuestion[] {
    this.assertReady();
    return [...(this.bySection.get(section) ?? [])];
  }

  getAllQuestions(): PersonalAssessmentQuestion[] {
    this.assertReady();
    return [...this.allQuestions];
  }

  getOnboardingBackedQuestionKeys(): readonly string[] {
    return this.getAllQuestions()
      .filter((question) => question.skipStorage)
      .map((question) => question.key);
  }

  findQuestionSection(key: string): number {
    this.assertReady();
    return this.keyToSection.get(key) ?? 0;
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
