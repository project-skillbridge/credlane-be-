import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  AssessmentQuestion,
  AssessmentType,
  QuestionReviewStatus,
  QuestionSource,
  QuestionType,
  VerifiedLevel,
} from '../../assessments/entities/assessment-question.entity';
import { QuestionQualityNote } from '../../assessments/entities/question-quality-note.entity';
import { AdminQuestionsBankService } from './admin-questions-bank.service';

describe('AdminQuestionsBankService', () => {
  let service: AdminQuestionsBankService;
  let getManyAndCount: jest.Mock;
  let findOne: jest.Mock;
  let save: jest.Mock;
  let create: jest.Mock;
  let count: jest.Mock;
  let noteFind: jest.Mock;
  let noteCreate: jest.Mock;
  let noteSave: jest.Mock;

  const baseQuestion: AssessmentQuestion = {
    id: 'q-1',
    assessment_type: AssessmentType.SKILL,
    question_type: QuestionType.SINGLE_PICK,
    question_text: 'What is a closure?',
    question_number: 1,
    options: ['a', 'b'],
    correct_answer: 'a',
    track: 'frontend_developer',
    verified_level: VerifiedLevel.MID,
    competency: 'react-hooks',
    slot_type: null,
    metadata: null,
    is_live: true,
    review_status: QuestionReviewStatus.ACTIVE,
    source: QuestionSource.IMPORT,
    added_by: null,
    added_by_user: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };

  let getRawMany: jest.Mock;

  beforeEach(async () => {
    getManyAndCount = jest.fn();
    getRawMany = jest.fn().mockResolvedValue([]);
    findOne = jest.fn();
    save = jest.fn((q) => Promise.resolve(q));
    create = jest.fn((input) => input);
    count = jest.fn();
    noteFind = jest.fn();
    noteCreate = jest.fn((input) => input);
    noteSave = jest.fn((n) => Promise.resolve({ id: 'note-1', ...n }));

    const queryBuilder = {
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getManyAndCount,
      getRawMany,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminQuestionsBankService,
        {
          provide: getRepositoryToken(AssessmentQuestion),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
            findOne,
            save,
            create,
            count,
          },
        },
        {
          provide: getRepositoryToken(QuestionQualityNote),
          useValue: {
            find: noteFind,
            create: noteCreate,
            save: noteSave,
          },
        },
      ],
    }).compile();

    service = module.get(AdminQuestionsBankService);
  });

  describe('findAll', () => {
    it('maps rows to list rows exposing is_live, review_status, and source', async () => {
      getManyAndCount.mockResolvedValue([[baseQuestion], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({
        id: 'q-1',
        is_live: true,
        review_status: QuestionReviewStatus.ACTIVE,
        source: QuestionSource.IMPORT,
        track: 'frontend_developer',
      });
    });

    it('defaults page and limit when not provided', async () => {
      getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('findOne', () => {
    it('returns the question detail including options and metadata', async () => {
      findOne.mockResolvedValue(baseQuestion);

      const result = await service.findOne('q-1');

      expect(result.question.options).toEqual(['a', 'b']);
      expect(result.question.correct_answer).toBe('a');
    });

    it('throws NotFoundException when question does not exist', async () => {
      findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('flag', () => {
    it('sets review_status to flagged without touching is_live', async () => {
      findOne.mockResolvedValue({ ...baseQuestion });

      const result = await service.flag('q-1');

      expect(result.question.review_status).toBe(QuestionReviewStatus.FLAGGED);
      expect(result.question.is_live).toBe(true);
    });
  });

  describe('remove', () => {
    it('sets review_status to removed and clears is_live so it stops being served', async () => {
      findOne.mockResolvedValue({ ...baseQuestion });

      const result = await service.remove('q-1');

      expect(result.question.review_status).toBe(QuestionReviewStatus.REMOVED);
      expect(result.question.is_live).toBe(false);
    });

    it('throws NotFoundException for a missing question', async () => {
      findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('restore', () => {
    it('sets review_status back to active and relights is_live', async () => {
      findOne.mockResolvedValue({
        ...baseQuestion,
        review_status: QuestionReviewStatus.REMOVED,
        is_live: false,
      });

      const result = await service.restore('q-1');

      expect(result.question.review_status).toBe(QuestionReviewStatus.ACTIVE);
      expect(result.question.is_live).toBe(true);
    });
  });

  describe('edit', () => {
    it('updates only the provided fields', async () => {
      findOne.mockResolvedValue({ ...baseQuestion });

      const result = await service.edit('q-1', {
        questionText: 'Updated text',
      });

      expect(result.question.question_text).toBe('Updated text');
    });
  });

  describe('addManual', () => {
    it('creates a question with source manual, attributed to added_by', async () => {
      count.mockResolvedValue(4);

      const result = await service.addManual(
        {
          assessmentType: AssessmentType.SKILL,
          questionType: QuestionType.SINGLE_PICK,
          questionText: 'New question',
          track: 'frontend_developer',
          verifiedLevel: VerifiedLevel.MID,
        },
        'admin-1',
      );

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          question_number: 5,
          source: QuestionSource.MANUAL,
          added_by: 'admin-1',
          is_live: true,
        }),
      );
      expect(result.question.source).toBe(QuestionSource.MANUAL);
    });
  });

  describe('quality notes', () => {
    it('adds a note attributed to the acting admin', async () => {
      findOne.mockResolvedValue({ ...baseQuestion });

      const result = await service.addQualityNote(
        'q-1',
        'Looks ambiguous',
        'reviewer-1',
      );

      expect(noteCreate).toHaveBeenCalledWith({
        question_id: 'q-1',
        author_id: 'reviewer-1',
        note: 'Looks ambiguous',
      });
      expect(result.note.note).toBe('Looks ambiguous');
    });

    it('lists notes for a question, newest first', async () => {
      findOne.mockResolvedValue({ ...baseQuestion });
      noteFind.mockResolvedValue([{ id: 'note-1', note: 'first' }]);

      const result = await service.listQualityNotes('q-1');

      expect(result.items).toHaveLength(1);
      expect(noteFind).toHaveBeenCalledWith({
        where: { question_id: 'q-1' },
        order: { created_at: 'DESC' },
      });
    });

    it('throws NotFoundException when the question does not exist', async () => {
      findOne.mockResolvedValue(null);

      await expect(
        service.addQualityNote('missing', 'note', 'reviewer-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHealthGrid', () => {
    it('never claims a target capacity exists', async () => {
      const result = await service.getHealthGrid();

      expect(result.target_defined).toBe(false);
    });

    it('returns a full grid covering every assessment_type/track/level combination', async () => {
      const result = await service.getHealthGrid();

      // 2 assessment types x 20 tracks x 4 verified levels
      expect(result.cells).toHaveLength(160);
      expect(result.cells.every((cell) => cell.is_empty)).toBe(true);
      expect(result.cells.every((cell) => cell.live_count === 0)).toBe(true);
    });

    it('fills in real counts for combinations that have data and marks them non-empty', async () => {
      getRawMany.mockResolvedValue([
        {
          assessment_type: AssessmentType.SKILL,
          track: 'frontend_developer',
          verified_level: VerifiedLevel.MID,
          total: '5',
          live_count: '3',
          flagged_count: '1',
          removed_count: '1',
        },
      ]);

      const result = await service.getHealthGrid();

      const matchingCell = result.cells.find(
        (cell) =>
          cell.assessment_type === AssessmentType.SKILL &&
          cell.track === 'frontend_developer' &&
          cell.verified_level === VerifiedLevel.MID,
      );

      expect(matchingCell).toMatchObject({
        live_count: 3,
        flagged_count: 1,
        removed_count: 1,
        total_count: 5,
        is_empty: false,
      });
    });
  });
});
