import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmployerAssessmentsService } from './employer-assessments.service';
import {
  EmployerAssessment,
  EmployerAssessmentExperienceLevel,
  EmployerAssessmentQuestionSource,
} from './entities/employer-assessment.entity';
import {
  EmployerAssessmentQuestion,
  EmployerQuestionType,
} from './entities/employer-assessment-question.entity';
import {
  EmployerAssessmentDeliveryMode,
  EmployerAssessmentInvite,
} from './entities/employer-assessment-invite.entity';
import { EmployerAssessmentSubmission } from './entities/employer-assessment-submission.entity';
import { AssessmentQuestion } from '../assessments/entities/assessment-question.entity';
import { EmployerSavedCandidate } from '../employer-discovery/entities/employer-saved-candidate.entity';
import { User } from '../users/entities/user.entity';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';

describe('EmployerAssessmentsService', () => {
  let service: EmployerAssessmentsService;

  const mockAssessmentRepo = {
    count: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    manager: { transaction: jest.fn(), save: jest.fn() },
  };

  const mockQuestionRepo = { save: jest.fn() };
  const mockInviteRepo = { save: jest.fn() };

  const mockSubmissionRepo = {
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockBankQuestionRepo = { find: jest.fn() };
  const mockSavedCandidateRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
    findBy: jest.fn(),
  };

  const mockNotificationDispatch = { dispatch: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployerAssessmentsService,
        {
          provide: getRepositoryToken(EmployerAssessment),
          useValue: mockAssessmentRepo,
        },
        {
          provide: getRepositoryToken(EmployerAssessmentQuestion),
          useValue: mockQuestionRepo,
        },
        {
          provide: getRepositoryToken(EmployerAssessmentInvite),
          useValue: mockInviteRepo,
        },
        {
          provide: getRepositoryToken(EmployerAssessmentSubmission),
          useValue: mockSubmissionRepo,
        },
        {
          provide: getRepositoryToken(AssessmentQuestion),
          useValue: mockBankQuestionRepo,
        },
        {
          provide: getRepositoryToken(EmployerSavedCandidate),
          useValue: mockSavedCandidateRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: NotificationDispatchService,
          useValue: mockNotificationDispatch,
        },
      ],
    }).compile();

    service = module.get<EmployerAssessmentsService>(
      EmployerAssessmentsService,
    );
    jest.clearAllMocks();
  });

  // ─── createAssessment ──────────────────────────────────────────────────────

  describe('createAssessment', () => {
    const baseDto = {
      title: 'Frontend Assessment',
      roleTrack: 'frontend_developer',
      experienceLevel: EmployerAssessmentExperienceLevel.MID,
      timeLimitMinutes: 30,
      passingThreshold: 70,
      questionSource: EmployerAssessmentQuestionSource.COMPANY_QUESTIONS,
      shareViaLink: true,
      sendToCandidates: false,
      questions: Array.from({ length: 5 }, (_, i) => ({
        questionText: `Question ${i + 1}`,
        questionType: EmployerQuestionType.MULTIPLE_CHOICE,
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
      })),
    };

    it('should create an assessment with company questions', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-1',
        is_verified: true,
      });
      mockAssessmentRepo.count.mockResolvedValue(0);
      mockAssessmentRepo.manager.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => {
          const manager = {
            save: jest
              .fn()
              .mockResolvedValueOnce({
                id: 'assessment-1',
                employer_user_id: 'emp-1',
                title: baseDto.title,
                share_token: 'abc123',
                is_active: true,
              })
              .mockResolvedValueOnce([]),
          };
          return cb(manager);
        },
      );

      const result = await service.createAssessment('emp-1', baseDto);

      expect(result.id).toBe('assessment-1');
      expect(result.shareUrl).toContain('abc123');
    });

    it('should reject when less than 5 company questions are provided', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-1',
        is_verified: true,
      });
      mockAssessmentRepo.count.mockResolvedValue(0);

      const dto = {
        ...baseDto,
        questions: baseDto.questions.slice(0, 3),
      };

      await expect(service.createAssessment('emp-1', dto)).rejects.toThrow(
        'A minimum of 5 questions is required',
      );
    });

    it('should reject when 3 active assessments already exist', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-1',
        is_verified: true,
      });
      mockAssessmentRepo.count.mockResolvedValue(3);

      await expect(service.createAssessment('emp-1', baseDto)).rejects.toThrow(
        'active assessment limit',
      );
    });

    it('should reject when no delivery mode is selected', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-1',
        is_verified: true,
      });

      const dto = {
        ...baseDto,
        shareViaLink: false,
        sendToCandidates: false,
      };

      await expect(service.createAssessment('emp-1', dto)).rejects.toThrow(
        'Select at least one delivery mode',
      );
    });

    it('should reject unverified employers', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-1',
        is_verified: false,
      });

      await expect(service.createAssessment('emp-1', baseDto)).rejects.toThrow(
        'Only verified employers',
      );
    });
  });

  // ─── deactivateAssessment ──────────────────────────────────────────────────

  describe('deactivateAssessment', () => {
    it('should deactivate an active assessment', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-1',
        is_verified: true,
      });
      mockAssessmentRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.deactivateAssessment('emp-1', 'ass-1');

      expect(result.status).toBe('success');
      expect(mockAssessmentRepo.update).toHaveBeenCalledWith(
        { id: 'ass-1', employer_user_id: 'emp-1', is_active: true },
        { is_active: false },
      );
    });

    it('should throw NotFoundError if assessment not found or already inactive', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-1',
        is_verified: true,
      });
      mockAssessmentRepo.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.deactivateAssessment('emp-1', 'ass-1'),
      ).rejects.toThrow('Active assessment not found');
    });
  });

  // ─── getAssessment ────────────────────────────────────────────────────────

  describe('getAssessment', () => {
    it('should return an employer assessment with questions and share URL', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-1',
        is_verified: true,
      });
      mockAssessmentRepo.findOne.mockResolvedValue({
        id: 'ass-1',
        employer_user_id: 'emp-1',
        title: 'Frontend Assessment',
        share_token: 'token-abc',
        questions: [
          {
            id: 'q-1',
            position: 1,
            question_text: 'What is React?',
            question_type: EmployerQuestionType.SHORT_ANSWER,
            correct_answer: 'A library',
          },
        ],
      });

      const result = await service.getAssessment('emp-1', 'ass-1');

      expect(result.id).toBe('ass-1');
      expect(result.title).toBe('Frontend Assessment');
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].question_text).toBe('What is React?');
      expect(result.shareUrl).toContain('/assessments/token-abc');
      expect(mockAssessmentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'ass-1', employer_user_id: 'emp-1' },
        relations: ['questions'],
        order: { questions: { position: 'ASC' } },
      });
    });

    it('should scope lookup to the requesting employer and reject wrong-owner access', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-2',
        is_verified: true,
      });
      mockAssessmentRepo.findOne.mockResolvedValue(null);

      await expect(service.getAssessment('emp-2', 'ass-1')).rejects.toThrow(
        'Assessment not found',
      );

      expect(mockAssessmentRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ass-1', employer_user_id: 'emp-2' },
        }),
      );
    });

    it('should throw NotFoundError when assessment does not exist', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-1',
        is_verified: true,
      });
      mockAssessmentRepo.findOne.mockResolvedValue(null);

      await expect(service.getAssessment('emp-1', 'missing-ass')).rejects.toThrow(
        'Assessment not found',
      );
    });
  });

  // ─── getPublicAssessmentByToken ────────────────────────────────────────────

  describe('getPublicAssessmentByToken', () => {
    it('should strip correct answers from returned questions', async () => {
      mockAssessmentRepo.findOne.mockResolvedValue({
        id: 'ass-1',
        is_active: true,
        share_token: 'token-abc',
        questions: [
          {
            id: 'q-1',
            question_text: 'What is 1+1?',
            question_type: EmployerQuestionType.MULTIPLE_CHOICE,
            options: ['1', '2', '3'],
            correct_answer: '2',
            position: 1,
          },
        ],
      });

      const result = await service.getPublicAssessmentByToken('token-abc');
      const question = result.questions[0] as Record<string, unknown>;

      expect(question.question_text).toBe('What is 1+1?');
      expect(question).not.toHaveProperty('correct_answer');
    });

    it('should throw ForbiddenError for deactivated assessments', async () => {
      mockAssessmentRepo.findOne.mockResolvedValue({
        id: 'ass-1',
        is_active: false,
      });

      await expect(
        service.getPublicAssessmentByToken('token-abc'),
      ).rejects.toThrow('no longer accepting submissions');
    });

    it('should throw NotFoundError for unknown token', async () => {
      mockAssessmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getPublicAssessmentByToken('bad-token'),
      ).rejects.toThrow('Assessment not found');
    });
  });

  // ─── submitAssessment ──────────────────────────────────────────────────────

  describe('submitAssessment', () => {
    const questions = [
      {
        id: 'q-1',
        correct_answer: 'A',
        question_text: 'Q1',
        question_type: EmployerQuestionType.MULTIPLE_CHOICE,
      },
      {
        id: 'q-2',
        correct_answer: 'True',
        question_text: 'Q2',
        question_type: EmployerQuestionType.TRUE_FALSE,
      },
      {
        id: 'q-3',
        correct_answer: 'B',
        question_text: 'Q3',
        question_type: EmployerQuestionType.MULTIPLE_CHOICE,
      },
      {
        id: 'q-4',
        correct_answer: 'C',
        question_text: 'Q4',
        question_type: EmployerQuestionType.MULTIPLE_CHOICE,
      },
      {
        id: 'q-5',
        correct_answer: 'D',
        question_text: 'Q5',
        question_type: EmployerQuestionType.MULTIPLE_CHOICE,
      },
    ];

    const assessment = {
      id: 'ass-1',
      is_active: true,
      share_token: 'token-abc',
      passing_threshold: 60,
      questions,
    };

    it('should compute score server-side and save submission', async () => {
      mockAssessmentRepo.findOne.mockResolvedValue(assessment);
      mockSubmissionRepo.findOne.mockResolvedValue(null);
      mockSubmissionRepo.save.mockImplementation(async (data: unknown) => ({
        id: 'sub-1',
        ...(data as Record<string, unknown>),
      }));

      const result = await service.submitAssessment(
        'candidate-1',
        'token-abc',
        {
          timeTakenSeconds: 600,
          deliveryMode: EmployerAssessmentDeliveryMode.LINK,
          answers: {
            'q-1': 'A',
            'q-2': 'True',
            'q-3': 'B',
            'q-4': 'C',
            'q-5': 'D',
          },
        },
      );

      // All 5 correct → score should be 100
      expect(result.score).toBe(100);
      expect(result.passed).toBe(true);
    });

    it('should compute partial score correctly', async () => {
      mockAssessmentRepo.findOne.mockResolvedValue(assessment);
      mockSubmissionRepo.findOne.mockResolvedValue(null);
      mockSubmissionRepo.save.mockImplementation(async (data: unknown) => ({
        id: 'sub-1',
        ...(data as Record<string, unknown>),
      }));

      const result = await service.submitAssessment(
        'candidate-1',
        'token-abc',
        {
          timeTakenSeconds: 300,
          deliveryMode: EmployerAssessmentDeliveryMode.LINK,
          answers: {
            'q-1': 'A',
            'q-2': 'False', // wrong
            'q-3': 'A', // wrong
            'q-4': 'C',
            'q-5': 'D',
          },
        },
      );

      // 3 out of 5 correct → 60%
      expect(result.score).toBe(60);
      expect(result.passed).toBe(true); // threshold is 60
    });

    it('should reject duplicate submissions', async () => {
      mockAssessmentRepo.findOne.mockResolvedValue(assessment);
      mockSubmissionRepo.findOne.mockResolvedValue({
        id: 'existing-sub',
      });

      await expect(
        service.submitAssessment('candidate-1', 'token-abc', {
          timeTakenSeconds: 300,
          deliveryMode: EmployerAssessmentDeliveryMode.LINK,
          answers: {},
        }),
      ).rejects.toThrow('already submitted');
    });

    it('should reject submissions for deactivated assessments', async () => {
      mockAssessmentRepo.findOne.mockResolvedValue({
        ...assessment,
        is_active: false,
      });

      await expect(
        service.submitAssessment('candidate-1', 'token-abc', {
          timeTakenSeconds: 300,
          deliveryMode: EmployerAssessmentDeliveryMode.LINK,
          answers: {},
        }),
      ).rejects.toThrow('no longer accepting submissions');
    });
  });

  // ─── validateUploadedQuestionFile ──────────────────────────────────────────

  describe('validateUploadedQuestionFile', () => {
    it('should reject when no file is provided', () => {
      expect(() => service.validateUploadedQuestionFile(undefined)).toThrow(
        "couldn't read this file",
      );
    });

    it('should reject files larger than 5MB', () => {
      const file = {
        originalname: 'questions.csv',
        size: 6 * 1024 * 1024,
        buffer: Buffer.from(''),
      } as Express.Multer.File;

      expect(() => service.validateUploadedQuestionFile(file)).toThrow('5 MB');
    });

    it('should reject unsupported file extensions', () => {
      const file = {
        originalname: 'questions.pdf',
        size: 100,
        buffer: Buffer.from(''),
      } as Express.Multer.File;

      expect(() => service.validateUploadedQuestionFile(file)).toThrow(
        "couldn't read this file",
      );
    });

    it('should validate and import a valid CSV file', () => {
      const csv = [
        'Question Text,Question Type,Option A,Option B,Option C,Option D,Correct Answer',
        '"What is 1+1?","Multiple Choice","1","2","3","4","2"',
        '"Is the sky blue?","True/False","True","False","","","True"',
        '"Explain OOP","Short Answer","","","","","Encapsulation"',
        '"What is CSS?","Multiple Choice","Styling","Logic","Data","Storage","Styling"',
        '"HTML is markup?","True/False","True","False","","","True"',
      ].join('\n');

      const file = {
        originalname: 'questions.csv',
        size: Buffer.byteLength(csv),
        buffer: Buffer.from(csv),
      } as Express.Multer.File;

      const result = service.validateUploadedQuestionFile(file);

      expect(result.status).toBe('success');
      expect(result.questionCount).toBe(5);
      expect(result.questions[0].questionText).toBe('What is 1+1?');
      expect(result.questions[0].correctAnswer).toBe('2');
    });

    it('should validate and import a valid XLSX file', () => {
      const xlsx = service.getTemplateXlsx();
      const file = {
        originalname: 'questions.xlsx',
        size: xlsx.length,
        buffer: xlsx,
      } as Express.Multer.File;

      const result = service.validateUploadedQuestionFile(file);

      expect(result.status).toBe('success');
      expect(result.questionCount).toBeGreaterThan(0);
      expect(result.questions[0].questionText).toBe(
        'Which option best answers the question?',
      );
      expect(result.questions[0].questionType).toBe(
        EmployerQuestionType.MULTIPLE_CHOICE,
      );
    });

    it('should flag missing columns', () => {
      const csv = 'Question Text,Question Type\n"Q1","Multiple Choice"\n';

      const file = {
        originalname: 'questions.csv',
        size: Buffer.byteLength(csv),
        buffer: Buffer.from(csv),
      } as Express.Multer.File;

      expect(() => service.validateUploadedQuestionFile(file)).toThrow(
        'Missing required columns',
      );
    });

    it('should flag missing question text before missing correct answer', () => {
      const csv = [
        'Question Text,Question Type,Option A,Option B,Option C,Option D,Correct Answer',
        ',"Multiple Choice","A","B","C","D",',
      ].join('\n');

      const file = {
        originalname: 'questions.csv',
        size: Buffer.byteLength(csv),
        buffer: Buffer.from(csv),
      } as Express.Multer.File;

      expect(() => service.validateUploadedQuestionFile(file)).toThrow(
        'missing question text',
      );
    });

    it('should flag missing correct answer', () => {
      const csv = [
        'Question Text,Question Type,Option A,Option B,Option C,Option D,Correct Answer',
        '"What is 1+1?","Multiple Choice","1","2","3","4",',
      ].join('\n');

      const file = {
        originalname: 'questions.csv',
        size: Buffer.byteLength(csv),
        buffer: Buffer.from(csv),
      } as Express.Multer.File;

      expect(() => service.validateUploadedQuestionFile(file)).toThrow(
        'missing a correct answer',
      );
    });

    it('should flag unsupported question types', () => {
      const csv = [
        'Question Text,Question Type,Option A,Option B,Option C,Option D,Correct Answer',
        '"What is 1+1?","Essay","1","2","3","4","2"',
      ].join('\n');

      const file = {
        originalname: 'questions.csv',
        size: Buffer.byteLength(csv),
        buffer: Buffer.from(csv),
      } as Express.Multer.File;

      expect(() => service.validateUploadedQuestionFile(file)).toThrow(
        'unsupported question type',
      );
    });
  });

  // ─── listResults ───────────────────────────────────────────────────────────

  describe('listResults', () => {
    it('should return results filtered by pass/fail status', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-1',
        is_verified: true,
      });
      mockAssessmentRepo.findOne.mockResolvedValue({
        id: 'ass-1',
        employer_user_id: 'emp-1',
      });

      const submissions = [
        {
          id: 'sub-1',
          candidate_user_id: 'c-1',
          candidate: { first_name: 'John', last_name: 'Doe' },
          score: 80,
          passed: true,
          time_taken_seconds: 600,
          completed_at: new Date(),
          delivery_mode: EmployerAssessmentDeliveryMode.LINK,
        },
      ];
      mockSubmissionRepo.findAndCount.mockResolvedValue([submissions, 1]);

      const result = await service.listResults('emp-1', 'ass-1', {
        status: 'pass',
      });

      expect(result.submissions[0].candidateName).toBe('John Doe');
      expect(result.submissions[0].status).toBe('pass');
      expect(result.total).toBe(1);
    });

    it('should return empty state when no submissions exist', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-1',
        is_verified: true,
      });
      mockAssessmentRepo.findOne.mockResolvedValue({
        id: 'ass-1',
        employer_user_id: 'emp-1',
      });
      mockSubmissionRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.listResults('emp-1', 'ass-1', {});

      expect(result.emptyState).toContain('No submissions yet');
    });
  });

  // ─── listAssessments ───────────────────────────────────────────────────────

  describe('listAssessments', () => {
    it('should return assessments and no empty state when assessments exist', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-1',
        is_verified: true,
      });
      mockAssessmentRepo.find.mockResolvedValue([
        {
          id: 'ass-1',
          employer_user_id: 'emp-1',
          title: 'Frontend Assessment',
          created_at: new Date('2026-05-01T00:00:00.000Z'),
          questions: [{ id: 'q-1', position: 1 }],
        },
        {
          id: 'ass-2',
          employer_user_id: 'emp-1',
          title: 'Backend Assessment',
          created_at: new Date('2026-05-02T00:00:00.000Z'),
          questions: [{ id: 'q-2', position: 1 }],
        },
      ]);

      const result = await service.listAssessments('emp-1');

      expect(result.assessments).toHaveLength(2);
      expect(result.emptyState).toBeNull();
      expect(mockAssessmentRepo.find).toHaveBeenCalledWith({
        where: { employer_user_id: 'emp-1' },
        order: { created_at: 'DESC' },
        relations: ['questions'],
      });
    });

    it('should return empty state when no assessments exist', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-1',
        is_verified: true,
      });
      mockAssessmentRepo.find.mockResolvedValue([]);

      const result = await service.listAssessments('emp-1');

      expect(result.emptyState).toContain('No assessments yet');
      expect(result.assessments).toHaveLength(0);
    });
  });

  // ─── searchCandidates ─────────────────────────────────────────────────────

  describe('searchCandidates', () => {
    const createQueryBuilderMock = () => {
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            candidateUserId: 'candidate-1',
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@example.com',
          },
          {
            candidateUserId: 'candidate-2',
            firstName: 'Grace',
            lastName: 'Hopper',
            email: 'grace@example.com',
          },
        ]),
      };
      mockSavedCandidateRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    };

    it('should search shortlisted candidates with ILIKE, ordering, and pagination', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-1',
        is_verified: true,
      });
      const qb = createQueryBuilderMock();

      const result = await service.searchCandidates('emp-1', {
        search: 'ada',
        page: 2,
        limit: 10,
      });

      expect(result).toEqual({
        candidates: [
          {
            candidateUserId: 'candidate-1',
            fullName: 'Ada Lovelace',
            email: 'ada@example.com',
          },
          {
            candidateUserId: 'candidate-2',
            fullName: 'Grace Hopper',
            email: 'grace@example.com',
          },
        ],
        total: 2,
        page: 2,
        limit: 10,
        totalPages: 1,
      });
      expect(mockSavedCandidateRepo.createQueryBuilder).toHaveBeenCalledWith(
        'saved',
      );
      expect(qb.innerJoin).toHaveBeenCalledWith(
        User,
        'u',
        'u.id = saved.candidate_user_id',
      );
      expect(qb.where).toHaveBeenCalledWith(
        'saved.employer_user_id = :employerUserId',
        { employerUserId: 'emp-1' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE :search'),
        { search: '%ada%' },
      );
      expect(qb.orderBy).toHaveBeenCalledWith('saved.created_at', 'DESC');
      expect(qb.offset).toHaveBeenCalledWith(10);
      expect(qb.limit).toHaveBeenCalledWith(10);
      expect(qb.getCount).toHaveBeenCalledTimes(1);
      expect(qb.getRawMany).toHaveBeenCalledTimes(1);
    });

    it('should reject unverified employers before searching candidates', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'emp-1',
        is_verified: false,
      });

      await expect(service.searchCandidates('emp-1', {})).rejects.toThrow(
        'Only verified employers',
      );
      expect(mockSavedCandidateRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  // ─── getTemplateCsv ────────────────────────────────────────────────────────

  describe('getTemplateCsv', () => {
    it('should return CSV with all required columns', () => {
      const csv = service.getTemplateCsv();
      const header = csv.split('\n')[0];

      expect(header).toContain('Question Text');
      expect(header).toContain('Question Type');
      expect(header).toContain('Option A');
      expect(header).toContain('Option B');
      expect(header).toContain('Option C');
      expect(header).toContain('Option D');
      expect(header).toContain('Correct Answer');
    });
  });

  // ─── getTemplateXlsx ───────────────────────────────────────────────────────

  describe('getTemplateXlsx', () => {
    it('should return a valid XLSX buffer', () => {
      const result = service.getTemplateXlsx();

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      // XLSX files start with the ZIP magic number PK\x03\x04
      expect(result.readUInt32LE(0)).toBe(0x04034b50);
    });
  });

  // ─── indexToColumnName (via XLSX output) ───────────────────────────────────

  describe('XLSX column naming', () => {
    it('should produce correct column refs in generated XLSX', () => {
      // Access private method through the XLSX output
      // The template has 7 columns (A-G), verify they appear in output
      const xlsxBuffer = service.getTemplateXlsx();
      const content = xlsxBuffer.toString('utf8');

      // Columns A through G should be present in cell refs
      expect(content).toContain('r="A1"');
      expect(content).toContain('r="G1"');
    });
  });
});
