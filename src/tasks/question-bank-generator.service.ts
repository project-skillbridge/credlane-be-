import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import {
  AssessmentQuestion,
  AssessmentType,
  QuestionType,
  SlotType,
  VerifiedLevel,
} from '../modules/assessments/entities';
import {
  GeneratedQuestion,
  GenerateQuestionsInput,
} from '../modules/ai/ai.types';
import { QuestionGenerationService } from '../modules/ai/question-generation.service';
import { BankExhaustedAlertService } from '../modules/mail/bank-exhausted-alert.service';
import { metadataDifficulty } from '../modules/talent/assessment/assessment-utils';
import {
  competenciesForTrack,
  normaliseCompetency,
} from '../modules/talent/assessment/competency-taxonomy';
import {
  TALENT_CLAIMED_LEVELS,
  TALENT_ROLE_TRACKS,
} from '../modules/talent/talent.constants';

export type QuestionBankGeneratorAssessmentType =
  | AssessmentType.SKILL
  | AssessmentType.ADVANCED;

export interface QuestionBankGeneratorRunOptions {
  batchSize: number;
  dryRun?: boolean;
  isLive?: boolean;
  assessmentTypes?: QuestionBankGeneratorAssessmentType[];
  tracks?: readonly string[];
  levels?: readonly VerifiedLevel[];
}

export interface QuestionBankGeneratorRunSummary {
  runId: string;
  startedAt: string;
  finishedAt: string;
  batchSize: number;
  dryRun: boolean;
  isLive: boolean;
  assessmentTypes: QuestionBankGeneratorAssessmentType[];
  tracks: string[];
  levels: VerifiedLevel[];
  generated: number;
  persisted: number;
  failures: number;
  skipped: number;
  details: Array<{
    assessmentType: QuestionBankGeneratorAssessmentType;
    track: string;
    verifiedLevel: VerifiedLevel;
    requested: number;
    generated: number;
    persisted: number;
    skipped: boolean;
  }>;
}

@Injectable()
export class QuestionBankGeneratorService {
  private readonly logger = new Logger(QuestionBankGeneratorService.name);
  private readonly lockName = 'question-bank-generator';

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly questionGeneration: QuestionGenerationService,
    private readonly bankExhaustedAlert: BankExhaustedAlertService,
  ) {}

  async run(
    options: QuestionBankGeneratorRunOptions,
  ): Promise<QuestionBankGeneratorRunSummary | null> {
    if (!Number.isInteger(options.batchSize) || options.batchSize < 1) {
      throw new Error('batchSize must be a positive integer');
    }

    const runId = randomUUID();
    const startedAt = new Date();
    const summary: QuestionBankGeneratorRunSummary = {
      runId,
      startedAt: startedAt.toISOString(),
      finishedAt: startedAt.toISOString(),
      batchSize: options.batchSize,
      dryRun: options.dryRun ?? false,
      isLive: options.isLive ?? true,
      assessmentTypes: options.assessmentTypes ?? [
        AssessmentType.SKILL,
        AssessmentType.ADVANCED,
      ],
      tracks: [...(options.tracks ?? TALENT_ROLE_TRACKS)],
      levels: [...(options.levels ?? TALENT_CLAIMED_LEVELS)],
      generated: 0,
      persisted: 0,
      failures: 0,
      skipped: 0,
      details: [],
    };

    const lockHandle = await this.acquireLock(runId);
    if (!lockHandle) {
      this.logger.warn(
        `[question-bank] skipped run ${runId}; another generator instance is already active`,
      );
      summary.finishedAt = new Date().toISOString();
      summary.skipped += 1;
      return summary;
    }

    try {
      for (const assessmentType of summary.assessmentTypes) {
        for (const track of summary.tracks) {
          for (const verifiedLevel of summary.levels) {
            const result = await this.generateForCombination({
              runId,
              assessmentType,
              track,
              verifiedLevel,
              batchSize: summary.batchSize,
              dryRun: summary.dryRun,
              isLive: summary.isLive,
            });
            summary.generated += result.generated;
            summary.persisted += result.persisted;
            summary.failures += result.failed ? 1 : 0;
            summary.details.push(result);
          }
        }
      }
      return summary;
    } finally {
      summary.finishedAt = new Date().toISOString();
      await this.releaseLock(lockHandle);
      this.logger.log(
        JSON.stringify(
          {
            event: 'question-bank-generator-complete',
            ...summary,
          },
          null,
          2,
        ),
      );
    }
  }

  private async generateForCombination(input: {
    runId: string;
    assessmentType: QuestionBankGeneratorAssessmentType;
    track: string;
    verifiedLevel: VerifiedLevel;
    batchSize: number;
    dryRun: boolean;
    isLive: boolean;
  }): Promise<{
    assessmentType: QuestionBankGeneratorAssessmentType;
    track: string;
    verifiedLevel: VerifiedLevel;
    requested: number;
    generated: number;
    persisted: number;
    skipped: boolean;
    failed: boolean;
  }> {
    if (input.assessmentType === AssessmentType.SKILL) {
      return this.generateSkillQuestions(input);
    }

    return this.generateAdvancedQuestions(input);
  }

  private async generateSkillQuestions(input: {
    runId: string;
    assessmentType: QuestionBankGeneratorAssessmentType;
    track: string;
    verifiedLevel: VerifiedLevel;
    batchSize: number;
    dryRun: boolean;
    isLive: boolean;
  }): Promise<{
    assessmentType: QuestionBankGeneratorAssessmentType;
    track: string;
    verifiedLevel: VerifiedLevel;
    requested: number;
    generated: number;
    persisted: number;
    skipped: boolean;
    failed: boolean;
  }> {
    const requested = input.batchSize;
    const generated = await this.generateWithRetry(
      {
        track: input.track,
        verified_level: input.verifiedLevel,
        assessment_type: AssessmentType.SKILL,
        question_type: QuestionType.SINGLE_PICK,
        count: requested,
      },
      input,
    );

    if (generated.length === 0) {
      return {
        assessmentType: input.assessmentType,
        track: input.track,
        verifiedLevel: input.verifiedLevel,
        requested,
        generated: 0,
        persisted: 0,
        skipped: true,
        failed: true,
      };
    }

    const persisted = input.dryRun
      ? 0
      : await this.persistGeneratedQuestions({
          assessmentType: AssessmentType.SKILL,
          track: input.track,
          verifiedLevel: input.verifiedLevel,
          generated,
          isLive: input.isLive,
          runId: input.runId,
        });

    return {
      assessmentType: input.assessmentType,
      track: input.track,
      verifiedLevel: input.verifiedLevel,
      requested,
      generated: generated.length,
      persisted,
      skipped: false,
      failed: false,
    };
  }

  private async generateAdvancedQuestions(input: {
    runId: string;
    assessmentType: QuestionBankGeneratorAssessmentType;
    track: string;
    verifiedLevel: VerifiedLevel;
    batchSize: number;
    dryRun: boolean;
    isLive: boolean;
  }): Promise<{
    assessmentType: QuestionBankGeneratorAssessmentType;
    track: string;
    verifiedLevel: VerifiedLevel;
    requested: number;
    generated: number;
    persisted: number;
    skipped: boolean;
    failed: boolean;
  }> {
    const allocations = this.splitAdvancedBatch(input.batchSize);
    const generated: Array<GeneratedQuestion & { slot_type: SlotType }> = [];

    for (const allocation of allocations) {
      const batch = await this.generateWithRetry(
        {
          track: input.track,
          verified_level: input.verifiedLevel,
          assessment_type: AssessmentType.ADVANCED,
          question_type: allocation.questionType,
          slot_type: allocation.slotType,
          count: allocation.count,
        },
        input,
      );

      generated.push(
        ...batch.map((question) => ({
          ...question,
          slot_type: question.slot_type ?? allocation.slotType,
        })),
      );
    }

    if (generated.length === 0) {
      return {
        assessmentType: input.assessmentType,
        track: input.track,
        verifiedLevel: input.verifiedLevel,
        requested: input.batchSize,
        generated: 0,
        persisted: 0,
        skipped: true,
        failed: true,
      };
    }

    const persisted = input.dryRun
      ? 0
      : await this.persistGeneratedQuestions({
          assessmentType: AssessmentType.ADVANCED,
          track: input.track,
          verifiedLevel: input.verifiedLevel,
          generated,
          isLive: input.isLive,
          runId: input.runId,
        });

    return {
      assessmentType: input.assessmentType,
      track: input.track,
      verifiedLevel: input.verifiedLevel,
      requested: input.batchSize,
      generated: generated.length,
      persisted,
      skipped: false,
      failed: false,
    };
  }

  private splitAdvancedBatch(batchSize: number): Array<{
    questionType: QuestionType;
    slotType: SlotType;
    count: number;
  }> {
    const sanitized = Math.max(1, Math.floor(batchSize));
    const mcqCount = Math.max(1, Math.floor(sanitized / 2));
    const shortTextCount = sanitized >= 3 ? 1 : 0;
    const situationalCount = sanitized >= 4 ? 1 : 0;
    const workTaskCount = Math.max(
      0,
      sanitized - mcqCount - shortTextCount - situationalCount,
    );

    const allocations: Array<{
      questionType: QuestionType;
      slotType: SlotType;
      count: number;
    }> = [];

    if (mcqCount > 0) {
      allocations.push({
        questionType: QuestionType.SINGLE_PICK,
        slotType: SlotType.WORK_TASK,
        count: mcqCount,
      });
    }
    if (shortTextCount > 0) {
      allocations.push({
        questionType: QuestionType.REQUIRED_TEXT,
        slotType: SlotType.SITUATIONAL,
        count: shortTextCount,
      });
    }
    if (situationalCount > 0) {
      allocations.push({
        questionType: QuestionType.OPTIONAL_TEXT,
        slotType: SlotType.SITUATIONAL,
        count: situationalCount,
      });
    }
    if (workTaskCount > 0) {
      allocations.push({
        questionType: QuestionType.OPTIONAL_TEXT,
        slotType: SlotType.WORK_TASK,
        count: workTaskCount,
      });
    }

    return allocations;
  }

  private async generateWithRetry(
    input: GenerateQuestionsInput,
    context: {
      runId: string;
      assessmentType: QuestionBankGeneratorAssessmentType;
      track: string;
      verifiedLevel: VerifiedLevel;
    },
  ): Promise<GeneratedQuestion[]> {
    const retries = 3;
    const baseDelayMs = 300;
    let lastError: unknown;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const questions =
          await this.questionGeneration.generateQuestions(input);
        if (!questions || questions.length === 0) {
          throw new Error('No questions generated');
        }
        if (questions.length < input.count) {
          this.logger.warn(
            `[question-bank] partial generation run=${context.runId} assessment=${context.assessmentType} track=${context.track} level=${context.verifiedLevel} requested=${input.count} got=${questions.length}`,
          );
        }
        return questions;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `[question-bank] generation failed attempt=${attempt}/${retries} run=${context.runId} assessment=${context.assessmentType} track=${context.track} level=${context.verifiedLevel}: ${message}`,
        );

        if (attempt < retries) {
          await this.delay(baseDelayMs * attempt);
        }
      }
    }

    const detail =
      lastError instanceof Error ? lastError.message : String(lastError);
    this.bankExhaustedAlert.notify({
      assessmentType: context.assessmentType,
      detail,
      track: context.track,
      verifiedLevel: context.verifiedLevel,
      expectedQuestions: input.count,
      gotQuestions: 0,
    });

    this.logger.error(
      `[question-bank] generation exhausted retries run=${context.runId} assessment=${context.assessmentType} track=${context.track} level=${context.verifiedLevel}: ${detail}`,
    );
    return [];
  }

  private async persistGeneratedQuestions(input: {
    assessmentType: AssessmentType;
    track: string;
    verifiedLevel: VerifiedLevel;
    generated: GeneratedQuestion[];
    isLive: boolean;
    runId: string;
  }): Promise<number> {
    if (input.generated.length === 0) {
      return 0;
    }

    return this.dataSource.transaction(async (manager) => {
      const nextQuestionNumber = await this.nextQuestionNumber(
        manager,
        input.assessmentType,
        input.track,
        input.verifiedLevel,
      );
      const trackHasTaxonomy = competenciesForTrack(input.track).length > 0;
      const nowIso = new Date().toISOString();

      const entities = input.generated.map((question, index) => {
        const competency = trackHasTaxonomy
          ? normaliseCompetency(input.track, question.competency)
          : (question.competency ?? null);

        const slotType =
          input.assessmentType === AssessmentType.SKILL
            ? null
            : (question.slot_type ?? SlotType.SITUATIONAL);

        return manager.create(AssessmentQuestion, {
          assessment_type: input.assessmentType,
          question_type: question.question_type,
          question_text: question.question_text.trim(),
          question_number: nextQuestionNumber + index,
          options: question.options,
          correct_answer: question.correct_answer,
          track: input.track,
          verified_level: input.verifiedLevel,
          competency,
          slot_type: slotType,
          metadata: this.buildMetadata({
            assessmentType: input.assessmentType,
            track: input.track,
            verifiedLevel: input.verifiedLevel,
            questionType: question.question_type,
            competency,
            slotType,
            runId: input.runId,
            nowIso,
          }),
          is_live: input.isLive,
        });
      });

      const saved = await manager.save(AssessmentQuestion, entities);
      this.logger.log(
        `[question-bank] persisted ${saved.length} questions assessment=${input.assessmentType} track=${input.track} level=${input.verifiedLevel} live=${input.isLive}`,
      );
      return saved.length;
    });
  }

  private buildMetadata(input: {
    assessmentType: AssessmentType;
    track: string;
    verifiedLevel: VerifiedLevel;
    questionType: QuestionType;
    competency: string | null;
    slotType: SlotType | null;
    runId: string;
    nowIso: string;
  }): Record<string, unknown> {
    const isTextQuestion =
      input.questionType === QuestionType.REQUIRED_TEXT ||
      input.questionType === QuestionType.OPTIONAL_TEXT;

    return {
      difficulty: metadataDifficulty(input.verifiedLevel),
      estimated_time_seconds: isTextQuestion ? 600 : 90,
      tags: [
        'generated',
        'question-bank-generator',
        input.assessmentType,
        input.track,
        input.verifiedLevel,
        input.questionType,
        input.slotType,
        input.competency,
      ].filter((tag): tag is string => Boolean(tag)),
      generated: true,
      generated_by: 'question-bank-generator',
      run_id: input.runId,
      generated_at: input.nowIso,
    };
  }

  private async nextQuestionNumber(
    manager: EntityManager,
    assessmentType: AssessmentType,
    track: string,
    verifiedLevel: VerifiedLevel,
  ): Promise<number> {
    const count = await manager.count(AssessmentQuestion, {
      where: {
        assessment_type: assessmentType,
        track,
        verified_level: verifiedLevel,
      },
    });

    return count + 1;
  }

  private async acquireLock(runId: string): Promise<QueryRunner | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    const lockRows = (await queryRunner.query(
      'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
      [this.lockName],
    )) as Array<{ locked: boolean }>;
    const locked = lockRows[0]?.locked ?? false;

    if (!locked) {
      await queryRunner.release();
      return null;
    }

    this.logger.log(`[question-bank] acquired lock for run ${runId}`);
    return queryRunner;
  }

  private async releaseLock(queryRunner: QueryRunner | null): Promise<void> {
    if (!queryRunner) {
      return;
    }

    try {
      await queryRunner.query('SELECT pg_advisory_unlock(hashtext($1))', [
        this.lockName,
      ]);
    } finally {
      await queryRunner.release();
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
