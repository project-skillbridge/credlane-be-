import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  AssessmentQuestion,
  AssessmentType,
  QuestionType,
  VerifiedLevel,
} from '../../assessments/entities/assessment-question.entity';
import { AdminQuestionsBankService } from './admin-questions-bank.service';

describe('AdminQuestionsBankService', () => {
  let service: AdminQuestionsBankService;
  let getManyAndCount: jest.Mock;
  let findOne: jest.Mock;

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
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    getManyAndCount = jest.fn();
    findOne = jest.fn();

    const queryBuilder = {
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminQuestionsBankService,
        {
          provide: getRepositoryToken(AssessmentQuestion),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
            findOne,
          },
        },
      ],
    }).compile();

    service = module.get(AdminQuestionsBankService);
  });

  describe('findAll', () => {
    it('maps rows to list rows with derived status', async () => {
      getManyAndCount.mockResolvedValue([[baseQuestion], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({
        id: 'q-1',
        status: 'live',
        track: 'frontend_developer',
      });
    });

    it('derives draft status for non-live questions', async () => {
      getManyAndCount.mockResolvedValue([
        [{ ...baseQuestion, is_live: false }],
        1,
      ]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items[0].status).toBe('draft');
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
});
