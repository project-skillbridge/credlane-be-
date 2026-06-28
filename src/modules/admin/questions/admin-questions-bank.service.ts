import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentQuestion } from '../../assessments/entities/assessment-question.entity';
import { ListQuestionsQueryDto } from './dto/list-questions-query.dto';

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
  /** No flag/remove review workflow exists yet (spec OQ pending) — derived from is_live only. */
  status: 'live' | 'draft';
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class AdminQuestionsBankService {
  constructor(
    @InjectRepository(AssessmentQuestion)
    private readonly questionRepository: Repository<AssessmentQuestion>,
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
    const question = await this.questionRepository.findOne({ where: { id } });
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return {
      question: {
        ...this.toListRow(question),
        options: question.options,
        correct_answer: question.correct_answer,
        metadata: question.metadata,
      },
    };
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
      status: question.is_live ? 'live' : 'draft',
      created_at: question.created_at,
      updated_at: question.updated_at,
    };
  }
}
