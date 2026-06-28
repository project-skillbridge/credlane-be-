import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AssessmentQuestion,
  QuestionReviewStatus,
  QuestionSource,
} from '../../assessments/entities/assessment-question.entity';
import { QuestionQualityNote } from '../../assessments/entities/question-quality-note.entity';
import { ListQuestionsQueryDto } from './dto/list-questions-query.dto';
import { AddQuestionDto } from './dto/add-question.dto';
import { EditQuestionDto } from './dto/edit-question.dto';

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

    if (query.assessment_type) {
      qb.andWhere('q.assessment_type = :assessmentType', {
        assessmentType: query.assessment_type,
      });
    }
    if (query.track) {
      qb.andWhere('q.track = :track', { track: query.track });
    }
    if (query.verified_level) {
      qb.andWhere('q.verified_level = :verifiedLevel', {
        verifiedLevel: query.verified_level,
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

    if (dto.question_text !== undefined) {
      question.question_text = dto.question_text;
    }
    if (dto.options !== undefined) {
      question.options = dto.options;
    }
    if (dto.correct_answer !== undefined) {
      question.correct_answer = dto.correct_answer;
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
        assessment_type: dto.assessment_type,
        track: dto.track,
        verified_level: dto.verified_level,
      },
    });

    const question = this.questionRepository.create({
      assessment_type: dto.assessment_type,
      question_type: dto.question_type,
      question_text: dto.question_text,
      question_number: existingCount + 1,
      track: dto.track,
      verified_level: dto.verified_level,
      options: dto.options ?? null,
      correct_answer: dto.correct_answer ?? null,
      competency: dto.competency ?? null,
      slot_type: dto.slot_type ?? null,
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
