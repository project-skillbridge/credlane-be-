import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AssessmentQuestion,
  AssessmentType,
  QuestionReviewStatus,
  QuestionSource,
  VerifiedLevel,
} from '../../assessments/entities/assessment-question.entity';
import { QuestionQualityNote } from '../../assessments/entities/question-quality-note.entity';
import {
  TALENT_CLAIMED_LEVELS,
  TALENT_ROLE_TRACKS,
} from '../../talent/talent.constants';
import { ListQuestionsQueryDto } from './dto/list-questions-query.dto';
import { AddQuestionDto } from './dto/add-question.dto';
import { EditQuestionDto } from './dto/edit-question.dto';

export interface QuestionBankHealthGridCell {
  assessment_type: AssessmentType;
  track: string;
  verified_level: VerifiedLevel;
  live_count: number;
  flagged_count: number;
  removed_count: number;
  total_count: number;
  is_empty: boolean;
}

interface HealthGridRawRow {
  assessment_type: AssessmentType;
  track: string;
  verified_level: VerifiedLevel;
  total: string;
  live_count: string;
  flagged_count: string;
  removed_count: string;
}

export interface QuestionListRow {
  id: string;
  assessment_type: string;
  question_type: string;
  question_text: string;
  question_number: number;
  track: string | null;
  verified_level: string | null;
  competency: string | null;
  slot_type: string | null;
  is_live: boolean;
  review_status: QuestionReviewStatus;
  source: QuestionSource;
  added_by: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class AdminQuestionsBankService {
  constructor(
    @InjectRepository(AssessmentQuestion)
    private readonly questionRepository: Repository<AssessmentQuestion>,
    @InjectRepository(QuestionQualityNote)
    private readonly qualityNoteRepository: Repository<QuestionQualityNote>,
  ) {}

  async findAll(query: ListQuestionsQueryDto): Promise<{
    items: QuestionListRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.questionRepository
      .createQueryBuilder('q')
      .orderBy('q.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.assessmentType) {
      qb.andWhere('q.assessment_type = :assessmentType', {
        assessmentType: query.assessmentType,
      });
    }
    if (query.track) {
      qb.andWhere('q.track = :track', { track: query.track });
    }
    if (query.verifiedLevel) {
      qb.andWhere('q.verified_level = :verifiedLevel', {
        verifiedLevel: query.verifiedLevel,
      });
    }
    if (query.search) {
      qb.andWhere('q.question_text ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    const [rows, total] = await qb.getManyAndCount();

    return {
      items: rows.map((row) => this.toListRow(row)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<{
    question: QuestionListRow & {
      options: string[] | null;
      correct_answer: string | null;
      metadata: Record<string, unknown> | null;
    };
  }> {
    const question = await this.getQuestionOrThrow(id);

    return {
      question: {
        ...this.toListRow(question),
        options: question.options,
        correct_answer: question.correct_answer,
        metadata: question.metadata,
      },
    };
  }

  async flag(id: string): Promise<{ question: QuestionListRow }> {
    const question = await this.getQuestionOrThrow(id);
    question.review_status = QuestionReviewStatus.FLAGGED;
    const saved = await this.questionRepository.save(question);
    return { question: this.toListRow(saved) };
  }

  async remove(id: string): Promise<{ question: QuestionListRow }> {
    const question = await this.getQuestionOrThrow(id);
    question.review_status = QuestionReviewStatus.REMOVED;
    question.is_live = false;
    const saved = await this.questionRepository.save(question);
    return { question: this.toListRow(saved) };
  }

  async restore(id: string): Promise<{ question: QuestionListRow }> {
    const question = await this.getQuestionOrThrow(id);
    question.review_status = QuestionReviewStatus.ACTIVE;
    question.is_live = true;
    const saved = await this.questionRepository.save(question);
    return { question: this.toListRow(saved) };
  }

  async edit(
    id: string,
    dto: EditQuestionDto,
  ): Promise<{ question: QuestionListRow }> {
    const question = await this.getQuestionOrThrow(id);

    if (dto.questionText !== undefined) {
      question.question_text = dto.questionText;
    }
    if (dto.options !== undefined) {
      question.options = dto.options;
    }
    if (dto.correctAnswer !== undefined) {
      question.correct_answer = dto.correctAnswer;
    }

    const saved = await this.questionRepository.save(question);
    return { question: this.toListRow(saved) };
  }

  async addManual(
    dto: AddQuestionDto,
    addedBy: string,
  ): Promise<{ question: QuestionListRow }> {
    const existingCount = await this.questionRepository.count({
      where: {
        assessment_type: dto.assessmentType,
        track: dto.track,
        verified_level: dto.verifiedLevel,
      },
    });

    const question = this.questionRepository.create({
      assessment_type: dto.assessmentType,
      question_type: dto.questionType,
      question_text: dto.questionText,
      question_number: existingCount + 1,
      track: dto.track,
      verified_level: dto.verifiedLevel,
      options: dto.options ?? null,
      correct_answer: dto.correctAnswer ?? null,
      competency: dto.competency ?? null,
      slot_type: dto.slotType ?? null,
      is_live: true,
      review_status: QuestionReviewStatus.ACTIVE,
      source: QuestionSource.MANUAL,
      added_by: addedBy,
    });

    const saved = await this.questionRepository.save(question);
    return { question: this.toListRow(saved) };
  }

  async addQualityNote(
    questionId: string,
    note: string,
    authorId: string,
  ): Promise<{ note: QuestionQualityNote }> {
    await this.getQuestionOrThrow(questionId);

    const created = this.qualityNoteRepository.create({
      question_id: questionId,
      author_id: authorId,
      note,
    });
    const saved = await this.qualityNoteRepository.save(created);
    return { note: saved };
  }

  async listQualityNotes(
    questionId: string,
  ): Promise<{ items: QuestionQualityNote[] }> {
    await this.getQuestionOrThrow(questionId);

    const items = await this.qualityNoteRepository.find({
      where: { question_id: questionId },
      order: { created_at: 'DESC' },
    });
    return { items };
  }

  /**
   * Raw counts per (assessment_type, track, verified_level) combination.
   * There is no target-capacity concept anywhere in the codebase yet —
   * QuestionBankGeneratorService/BankExhaustedAlertService only fire a
   * reactive alert when AI generation fails 3 retries, not a percentage
   * threshold against a defined pool size. Inventing a denominator here
   * would produce an authoritative-looking but meaningless percentage, so
   * this surfaces raw counts and `is_empty` (zero live questions) only.
   * `target_defined: false` is included so the frontend can render an
   * honest "no target set" state instead of a fabricated warning/critical
   * percentage, pending a product decision (spec OQ).
   */
  async getHealthGrid(): Promise<{
    target_defined: false;
    cells: QuestionBankHealthGridCell[];
  }> {
    const rawRows = await this.questionRepository
      .createQueryBuilder('q')
      .select('q.assessment_type', 'assessment_type')
      .addSelect('q.track', 'track')
      .addSelect('q.verified_level', 'verified_level')
      .addSelect('COUNT(*)', 'total')
      .addSelect('COUNT(*) FILTER (WHERE q.is_live)', 'live_count')
      .addSelect(
        `COUNT(*) FILTER (WHERE q.review_status = '${QuestionReviewStatus.FLAGGED}')`,
        'flagged_count',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE q.review_status = '${QuestionReviewStatus.REMOVED}')`,
        'removed_count',
      )
      .where('q.track IS NOT NULL')
      .andWhere('q.verified_level IS NOT NULL')
      .groupBy('q.assessment_type')
      .addGroupBy('q.track')
      .addGroupBy('q.verified_level')
      .getRawMany<HealthGridRawRow>();

    const countsByKey = new Map<string, HealthGridRawRow>(
      rawRows.map((row) => [
        this.healthGridKey(row.assessment_type, row.track, row.verified_level),
        row,
      ]),
    );

    const cells: QuestionBankHealthGridCell[] = [];
    for (const assessmentType of [
      AssessmentType.SKILL,
      AssessmentType.ADVANCED,
    ]) {
      for (const track of TALENT_ROLE_TRACKS) {
        for (const verifiedLevel of TALENT_CLAIMED_LEVELS) {
          const row = countsByKey.get(
            this.healthGridKey(assessmentType, track, verifiedLevel),
          );
          const liveCount = row ? Number(row.live_count) : 0;

          cells.push({
            assessment_type: assessmentType,
            track,
            verified_level: verifiedLevel,
            live_count: liveCount,
            flagged_count: row ? Number(row.flagged_count) : 0,
            removed_count: row ? Number(row.removed_count) : 0,
            total_count: row ? Number(row.total) : 0,
            is_empty: liveCount === 0,
          });
        }
      }
    }

    return { target_defined: false, cells };
  }

  private healthGridKey(
    assessmentType: string,
    track: string,
    verifiedLevel: string,
  ): string {
    return `${assessmentType}|${track}|${verifiedLevel}`;
  }

  private async getQuestionOrThrow(id: string): Promise<AssessmentQuestion> {
    const question = await this.questionRepository.findOne({ where: { id } });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }

  private toListRow(question: AssessmentQuestion): QuestionListRow {
    return {
      id: question.id,
      assessment_type: question.assessment_type,
      question_type: question.question_type,
      question_text: question.question_text,
      question_number: question.question_number,
      track: question.track,
      verified_level: question.verified_level,
      competency: question.competency,
      slot_type: question.slot_type,
      is_live: question.is_live,
      review_status: question.review_status,
      source: question.source,
      added_by: question.added_by,
      created_at: question.created_at,
      updated_at: question.updated_at,
    };
  }
}
