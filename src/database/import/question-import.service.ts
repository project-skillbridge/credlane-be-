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

// Max IDs per SELECT … = ANY($1) call and max entities per save() call.
// Keeps Postgres parameter count well under the 65 535 limit.
const CHUNK_SIZE = 500;

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

    // ── Step 1: validate all source objects up-front ──────────────────────
    const validSources: SourceQuestion[] = [];
    for (const raw of rawObjects) {
      const parsed = sourceQuestionSchema.safeParse(raw);
      if (!parsed.success) {
        result.skipped += 1;
        result.errors.push(
          `Invalid question object: ${parsed.error.issues[0]?.message ?? 'unknown error'}`,
        );
      } else {
        validSources.push(parsed.data);
      }
    }

    // ── Step 2: batch-fetch all existing rows by source_id ────────────────
    // One SELECT … = ANY($1) per chunk instead of one query per question.
    const allSourceIds = validSources.map((s) => s.id);
    const existingBySourceId = new Map<string, AssessmentQuestion>();

    for (let i = 0; i < allSourceIds.length; i += CHUNK_SIZE) {
      const chunk = allSourceIds.slice(i, i + CHUNK_SIZE);
      const rows = await this.questionRepo
        .createQueryBuilder('question')
        .where("question.metadata->>'source_id' = ANY(:ids)", { ids: chunk })
        .getMany();
      for (const row of rows) {
        const sid = (row.metadata as Record<string, unknown>)
          ?.source_id as string;
        if (sid) existingBySourceId.set(sid, row);
      }
    }

    // ── Step 3: pre-fetch max question_number per track+level+type ─────────
    // One MAX() query per unique combo instead of one per new question.
    const maxNumberCache = new Map<string, number>();

    const nextNumberFor = async (
      mapped: Partial<AssessmentQuestion>,
    ): Promise<number> => {
      const key = `${mapped.assessment_type}|${mapped.track}|${mapped.verified_level}`;
      if (!maxNumberCache.has(key)) {
        const row = await this.questionRepo
          .createQueryBuilder('question')
          .select('MAX(question.question_number)', 'max')
          .where('question.assessment_type = :type', {
            type: mapped.assessment_type,
          })
          .andWhere('question.track = :track', { track: mapped.track })
          .andWhere('question.verified_level = :level', {
            level: mapped.verified_level,
          })
          .getRawOne<{ max: string | null }>();
        maxNumberCache.set(key, Number(row?.max ?? 0));
      }
      const next = maxNumberCache.get(key)! + 1;
      maxNumberCache.set(key, next);
      return next;
    };

    // ── Step 4: build insert / update lists ───────────────────────────────
    const toInsert: AssessmentQuestion[] = [];
    const toUpdate: AssessmentQuestion[] = [];
    const summaryMap = new Map<string, ImportSummaryRow>();

    for (const source of validSources) {
      try {
        const existing = existingBySourceId.get(source.id);
        const questionNumber = existing
          ? existing.question_number
          : await nextNumberFor(mapSourceQuestion(source, 0));
        const mapped = mapSourceQuestion(source, questionNumber);

        if (existing) {
          Object.assign(existing, mapped);
          toUpdate.push(existing);
          result.updated += 1;
        } else {
          toInsert.push(this.questionRepo.create(mapped));
          result.inserted += 1;
        }

        const key = `${mapped.track}|${mapped.verified_level}|${source.assessment_stage}`;
        const row = summaryMap.get(key);
        if (row) {
          row.count += 1;
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

    // ── Step 5: bulk save in chunks ───────────────────────────────────────
    // TypeORM save() on an array emits a single multi-row INSERT / UPDATE
    // batch per chunk, replacing the previous one-row-per-call pattern.
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      await this.questionRepo.save(toInsert.slice(i, i + CHUNK_SIZE));
    }
    for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
      await this.questionRepo.save(toUpdate.slice(i, i + CHUNK_SIZE));
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
