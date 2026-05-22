import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AssessmentQuestion,
  AssessmentType,
} from '../../modules/assessments/entities/assessment-question.entity';
import { parseQuestionBankText } from './extract-json-objects';
import { mapSourceQuestion } from './map-source-question';
import {
  ImportResult,
  ImportSummaryRow,
  sourceQuestionSchema,
  type SourceQuestion,
} from './import.types';
import { resolveSourceToText } from './resolve-source';

@Injectable()
export class QuestionImportService {
  private readonly logger = new Logger(QuestionImportService.name);

  constructor(
    @InjectRepository(AssessmentQuestion)
    private readonly questionRepo: Repository<AssessmentQuestion>,
  ) {}

  async importFromInput(input: {
    fileBuffer?: Buffer;
    fileName?: string;
    driveUrl?: string;
  }): Promise<ImportResult> {
    const text = await resolveSourceToText(input);
    return this.importFromText(text);
  }

  async importFromText(text: string): Promise<ImportResult> {
    const rawObjects = parseQuestionBankText(text);
    const result: ImportResult = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      summary: [],
    };

    const summaryMap = new Map<string, ImportSummaryRow>();

    for (const raw of rawObjects) {
      const parsed = sourceQuestionSchema.safeParse(raw);
      if (!parsed.success) {
        result.skipped += 1;
        result.errors.push(
          `Invalid question object: ${parsed.error.issues[0]?.message ?? 'unknown error'}`,
        );
        continue;
      }

      const source = parsed.data;
      try {
        const action = await this.upsertQuestion(source);
        if (action === 'inserted') {
          result.inserted += 1;
        } else {
          result.updated += 1;
        }

        const mapped = mapSourceQuestion(source, 0);
        const key = `${mapped.track}|${mapped.verified_level}|${source.assessment_stage}`;
        const existing = summaryMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          summaryMap.set(key, {
            track: mapped.track ?? 'unknown',
            level: String(mapped.verified_level ?? 'unknown'),
            stage: source.assessment_stage,
            count: 1,
          });
        }
      } catch (error) {
        result.skipped += 1;
        result.errors.push(
          `Failed to import ${source.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    result.summary = [...summaryMap.values()].sort((a, b) =>
      `${a.track}${a.level}${a.stage}`.localeCompare(
        `${b.track}${b.level}${b.stage}`,
      ),
    );

    this.logger.log(
      `Import complete: inserted=${result.inserted} updated=${result.updated} skipped=${result.skipped}`,
    );

    return result;
  }

  private async upsertQuestion(
    source: SourceQuestion,
  ): Promise<'inserted' | 'updated'> {
    const existing = await this.questionRepo
      .createQueryBuilder('question')
      .where("question.metadata->>'source_id' = :sourceId", {
        sourceId: source.id,
      })
      .getOne();

    const nextNumber = existing
      ? existing.question_number
      : await this.nextQuestionNumber(source);

    const mapped = mapSourceQuestion(source, nextNumber);

    if (existing) {
      await this.questionRepo.update(existing.id, mapped);
      return 'updated';
    }

    await this.questionRepo.save(this.questionRepo.create(mapped));
    return 'inserted';
  }

  private async nextQuestionNumber(source: SourceQuestion): Promise<number> {
    const mapped = mapSourceQuestion(source, 0);
    const row = await this.questionRepo
      .createQueryBuilder('question')
      .select('MAX(question.question_number)', 'max')
      .where('question.assessment_type = :assessmentType', {
        assessmentType:
          source.assessment_stage === 'skill_assessment'
            ? AssessmentType.SKILL
            : AssessmentType.ADVANCED,
      })
      .andWhere('question.track = :track', { track: mapped.track })
      .andWhere('question.verified_level = :level', {
        level: mapped.verified_level,
      })
      .getRawOne<{ max: string | null }>();

    return Number(row?.max ?? 0) + 1;
  }

  /** Mark legacy inline seed questions inactive before first real import. */
  async deactivateLegacyPlaceholderQuestions(): Promise<void> {
    await this.questionRepo
      .createQueryBuilder()
      .update(AssessmentQuestion)
      .set({ is_live: false })
      .where("metadata->>'source_id' IS NULL")
      .andWhere('assessment_type = :type', { type: AssessmentType.ADVANCED })
      .execute();
  }
}
