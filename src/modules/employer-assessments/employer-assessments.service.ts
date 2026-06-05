import { randomBytes } from 'crypto';
import { inflateRawSync } from 'zlib';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import {
  BadRequestError,
  ConflictError,
  ErrorMessages,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
} from '../../shared';
import { EMPLOYER_ASSESSMENT_IMPORT_MAX_FILE_BYTES } from './employer-assessments.constants';
import {
  AssessmentQuestion,
  AssessmentType,
  QuestionType,
  VerifiedLevel,
} from '../assessments/entities/assessment-question.entity';
import { EmployerSavedCandidate } from '../employer-discovery/entities/employer-saved-candidate.entity';
import { EmployerRole } from '../employer-roles/entities/employer-role.entity';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import { NotificationType } from '../notifications/notification-type.enum';
import { Offer, OfferStatus } from '../offers/entities/offer.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateEmployerAssessmentDto,
  EmployerAssessmentQuestionInputDto,
} from './dto/create-employer-assessment.dto';
import { ListEmployerAssessmentResultsQueryDto } from './dto/list-employer-assessment-results-query.dto';
import { PublicEmployerAssessmentResponseDto } from './dto/employer-assessment-response.dto';
import { SearchAssessmentCandidatesQueryDto } from './dto/search-assessment-candidates-query.dto';
import { SubmitEmployerAssessmentDto } from './dto/submit-employer-assessment.dto';
import {
  EmployerAssessment,
  EmployerAssessmentExperienceLevel,
  EmployerAssessmentQuestionSource,
} from './entities/employer-assessment.entity';
import {
  EmployerAssessmentDeliveryMode,
  EmployerAssessmentInvite,
} from './entities/employer-assessment-invite.entity';
import {
  EmployerAssessmentQuestion,
  EmployerQuestionType,
} from './entities/employer-assessment-question.entity';
import { EmployerAssessmentSubmission } from './entities/employer-assessment-submission.entity';
import { CredlaneCatalogueAssessment } from './entities/credlane-catalogue-assessment.entity';

const ACTIVE_ASSESSMENT_LIMIT = 5;
const MIN_COMPANY_QUESTIONS = 5;
const TEMPLATE_COLUMNS = [
  'Question Text',
  'Question Type',
  'Option A',
  'Option B',
  'Option C',
  'Option D',
  'Correct Answer',
];
const XLSX_COLUMN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function isPostgresUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const code =
    (error as QueryFailedError & { code?: string }).code ??
    (error.driverError as { code?: string } | undefined)?.code;
  return code === '23505';
}

type OfferNotificationRow = {
  id: string;
  employer_user_id: string;
  candidate_user_id: string;
  role_title: string;
};

export type QuestionImportValidationResult = {
  status: 'success';
  questions: EmployerAssessmentQuestionInputDto[];
  questionCount: number;
};

@Injectable()
export class EmployerAssessmentsService {
  private readonly logger = new Logger(EmployerAssessmentsService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(EmployerAssessment)
    private readonly assessmentRepo: Repository<EmployerAssessment>,
    @InjectRepository(EmployerAssessmentQuestion)
    private readonly questionRepo: Repository<EmployerAssessmentQuestion>,
    @InjectRepository(EmployerAssessmentInvite)
    private readonly inviteRepo: Repository<EmployerAssessmentInvite>,
    @InjectRepository(EmployerAssessmentSubmission)
    private readonly submissionRepo: Repository<EmployerAssessmentSubmission>,
    @InjectRepository(AssessmentQuestion)
    private readonly bankQuestionRepo: Repository<AssessmentQuestion>,
    @InjectRepository(EmployerSavedCandidate)
    private readonly savedCandidateRepo: Repository<EmployerSavedCandidate>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(EmployerRole)
    private readonly employerRoleRepo: Repository<EmployerRole>,
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,
    @InjectRepository(CredlaneCatalogueAssessment)
    private readonly catalogueRepo: Repository<CredlaneCatalogueAssessment>,
    private readonly notificationDispatch: NotificationDispatchService,
  ) {}

  async createAssessment(
    employerUserId: string,
    dto: CreateEmployerAssessmentDto,
  ): Promise<EmployerAssessment & { shareUrl: string }> {
    await this.ensureVerifiedEmployer(employerUserId);

    if (!dto.shareViaLink && !dto.sendToCandidates) {
      throw new BadRequestError('Select at least one delivery mode');
    }

    const candidateUserIds = dto.sendToCandidates
      ? (dto.candidateUserIds ?? [])
      : [];
    if (new Set(candidateUserIds).size !== candidateUserIds.length) {
      throw new BadRequestError('Candidate list contains duplicate entries');
    }

    if (dto.questionSource === EmployerAssessmentQuestionSource.CREDLANE_BANK) {
      const catalogueItem = await this.catalogueRepo.findOne({
        where: { id: dto.credlaneAssessmentId, is_active: true },
      });
      if (!catalogueItem) {
        throw new BadRequestError(
          'The selected CredLane catalogue assessment was not found or is no longer available',
        );
      }
      // Validate that catalogue item matches the dto role_track and experience_level
      if (
        catalogueItem.role_track !== dto.roleTrack.trim() ||
        catalogueItem.experience_level !== dto.experienceLevel
      ) {
        throw new BadRequestError(
          'The selected catalogue assessment does not match the specified role track and experience level',
        );
      }
    }

    const questions =
      dto.questionSource === EmployerAssessmentQuestionSource.CREDLANE_BANK
        ? await this.buildQuestionsFromCredLaneBank(dto)
        : this.normalizeCompanyQuestions(dto.questions ?? []);

    if (
      dto.questionSource ===
        EmployerAssessmentQuestionSource.COMPANY_QUESTIONS &&
      questions.length < MIN_COMPANY_QUESTIONS
    ) {
      throw new BadRequestError(
        'A minimum of 5 questions is required before the assessment can be generated',
      );
    }

    const assessment = await this.assessmentRepo.manager.transaction(
      async (manager) => {
        await this.lockEmployerForAssessmentCreation(manager, employerUserId);

        const activeCount = await manager.count(EmployerAssessment, {
          where: { employer_user_id: employerUserId, is_active: true },
        });
        if (activeCount >= ACTIVE_ASSESSMENT_LIMIT) {
          throw new TooManyRequestsError(
            'You have reached your active assessment limit. Deactivate an existing assessment to create a new one.',
          );
        }

        const created = await manager.save(EmployerAssessment, {
          employer_user_id: employerUserId,
          title: dto.title.trim(),
          role_track: dto.roleTrack.trim(),
          experience_level: dto.experienceLevel,
          time_limit_minutes: dto.timeLimitMinutes,
          passing_threshold: dto.passingThreshold,
          question_source: dto.questionSource,
          credlane_assessment_id:
            dto.questionSource ===
            EmployerAssessmentQuestionSource.CREDLANE_BANK
              ? (dto.credlaneAssessmentId ?? null)
              : null,
          share_via_link: dto.shareViaLink,
          send_to_candidates: dto.sendToCandidates,
          share_token: randomBytes(24).toString('hex'),
          is_active: true,
        } as Partial<EmployerAssessment>);

        await manager.save(
          EmployerAssessmentQuestion,
          questions.map((question, index) => ({
            assessment_id: created.id,
            position: index + 1,
            question_text: question.questionText.trim(),
            question_type: question.questionType,
            options: question.options ?? null,
            correct_answer: question.correctAnswer.trim(),
          })),
        );

        if (dto.sendToCandidates) {
          await manager.save(
            EmployerAssessmentInvite,
            candidateUserIds.map((candidateUserId) => ({
              assessment_id: created.id,
              candidate_user_id: candidateUserId,
              delivery_mode: EmployerAssessmentDeliveryMode.DIRECT,
            })),
          );
        }

        return created;
      },
    );

    if (dto.sendToCandidates) {
      await this.notifyCandidates(assessment, candidateUserIds);
    }

    return Object.assign(assessment, {
      shareUrl: this.buildShareUrl(assessment.share_token),
    });
  }

  async listAssessments(employerUserId: string): Promise<{
    assessments: EmployerAssessment[];
    emptyState: string | null;
  }> {
    await this.ensureVerifiedEmployer(employerUserId);
    const assessments = await this.assessmentRepo.find({
      where: { employer_user_id: employerUserId },
      order: { created_at: 'DESC' },
      relations: ['questions'],
    });
    return {
      assessments,
      emptyState:
        assessments.length === 0
          ? 'No assessments yet. Create your first assessment to start screening candidates.'
          : null,
    };
  }

  async listCredlaneCatalogue(
    employerUserId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    catalogue: {
      id: string;
      title: string;
      description: string | null;
      estimated_completion_time: string;
      role_track: string;
      experience_level: EmployerAssessmentExperienceLevel;
    }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    await this.ensureVerifiedEmployer(employerUserId);
    const [entries, total] = await this.catalogueRepo.findAndCount({
      where: { is_active: true },
      order: { role_track: 'ASC', experience_level: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      catalogue: entries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        description: entry.description,
        estimated_completion_time: entry.estimated_completion_time,
        role_track: entry.role_track,
        experience_level: entry.experience_level,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAssessment(
    employerUserId: string,
    assessmentId: string,
  ): Promise<EmployerAssessment & { shareUrl: string }> {
    await this.ensureVerifiedEmployer(employerUserId);
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, employer_user_id: employerUserId },
      relations: ['questions'],
      order: { questions: { position: 'ASC' } },
    });
    if (!assessment) {
      throw new NotFoundError('Assessment not found');
    }
    return Object.assign(assessment, {
      shareUrl: this.buildShareUrl(assessment.share_token),
    });
  }

  async deactivateAssessment(
    employerUserId: string,
    assessmentId: string,
  ): Promise<{ status: string; message: string }> {
    await this.ensureVerifiedEmployer(employerUserId);
    const result = await this.assessmentRepo.update(
      { id: assessmentId, employer_user_id: employerUserId, is_active: true },
      { is_active: false },
    );
    if (!result.affected) {
      throw new NotFoundError('Active assessment not found');
    }
    return { status: 'success', message: 'Assessment link deactivated' };
  }

  async getPublicAssessmentByToken(
    token: string,
  ): Promise<PublicEmployerAssessmentResponseDto> {
    const assessment = await this.assessmentRepo.findOne({
      where: { share_token: token },
      relations: ['questions'],
      order: { questions: { position: 'ASC' } },
    });
    if (!assessment) {
      throw new NotFoundError('Assessment not found');
    }
    if (!assessment.is_active) {
      throw new ForbiddenError(
        'This assessment is no longer accepting submissions.',
      );
    }
    return {
      id: assessment.id,
      title: assessment.title,
      role_track: assessment.role_track,
      experience_level: assessment.experience_level,
      time_limit_minutes: assessment.time_limit_minutes,
      passing_threshold: assessment.passing_threshold,
      questions: assessment.questions.map((question) => ({
        id: question.id,
        position: question.position,
        question_text: question.question_text,
        question_type: question.question_type,
        options: question.options,
      })),
    };
  }

  async submitAssessment(
    candidateUserId: string,
    token: string,
    dto: SubmitEmployerAssessmentDto,
  ): Promise<EmployerAssessmentSubmission> {
    // Load assessment with correct answers for server-side scoring
    const assessment = await this.assessmentRepo.findOne({
      where: { share_token: token },
      relations: ['questions'],
      order: { questions: { position: 'ASC' } },
    });
    if (!assessment) {
      throw new NotFoundError('Assessment not found');
    }
    if (!assessment.is_active) {
      throw new ForbiddenError(
        'This assessment is no longer accepting submissions.',
      );
    }

    // Prevent duplicate submissions
    const existing = await this.submissionRepo.findOne({
      where: {
        assessment_id: assessment.id,
        candidate_user_id: candidateUserId,
      },
    });
    if (existing) {
      throw new ConflictError('You have already submitted this assessment.');
    }

    // Compute score server-side from answers vs correct answers
    const score = this.computeScore(assessment.questions, dto.answers ?? {});
    const passed = score >= assessment.passing_threshold;

    let submission: EmployerAssessmentSubmission;
    let updatedOffers: OfferNotificationRow[];
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const saved = await manager.save(EmployerAssessmentSubmission, {
          assessment_id: assessment.id,
          candidate_user_id: candidateUserId,
          score,
          passed,
          time_taken_seconds: dto.timeTakenSeconds,
          delivery_mode: dto.deliveryMode,
          answers: dto.answers ?? null,
        } as Partial<EmployerAssessmentSubmission>);

        const offers = await this.updateLinkedOffersInTx(
          manager,
          candidateUserId,
          assessment.id,
          passed,
        );

        return { saved, offers };
      });

      submission = result.saved;
      updatedOffers = result.offers;
    } catch (error: unknown) {
      if (isPostgresUniqueViolation(error)) {
        throw new ConflictError('You have already submitted this assessment.');
      }
      throw error;
    }

    // Dispatch notifications after the transaction commits so DB changes are
    // durable before any email/push is sent.
    if (updatedOffers.length > 0) {
      const candidate = await this.userRepo.findOne({
        where: { id: candidateUserId },
        select: ['id', 'first_name', 'last_name'],
      });
      const candidateName = candidate
        ? `${candidate.first_name ?? ''} ${candidate.last_name ?? ''}`.trim()
        : 'A candidate';

      await this.notifyAssessmentResult(
        updatedOffers,
        candidateUserId,
        passed,
        score,
        candidateName,
      );
    }

    return submission;
  }

  private computeScore(
    questions: EmployerAssessmentQuestion[],
    answers: Record<string, unknown>,
  ): number {
    if (questions.length === 0) return 0;
    let correct = 0;
    for (const question of questions) {
      const submitted = this.normalizeSubmittedAnswer(answers[question.id]);
      const expected = question.correct_answer.trim().toLowerCase();
      if (submitted === expected) {
        correct += 1;
      }
    }
    return Math.round((correct / questions.length) * 100);
  }

  private normalizeSubmittedAnswer(value: unknown): string {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value).trim().toLowerCase();
    }
    return '';
  }

  private async updateLinkedOffersInTx(
    manager: EntityManager,
    candidateUserId: string,
    assessmentId: string,
    passed: boolean,
  ): Promise<OfferNotificationRow[]> {
    const roles = await this.employerRoleRepo.find({
      where: { assessment_id: assessmentId },
      select: ['id'],
    });
    const roleIds = roles.map((role) => role.id);

    if (roleIds.length === 0) {
      return [];
    }

    // Pre-fetch only the UNLOCKED offers that this submission should transition.
    // This avoids re-fetching historical PASSED/FAILED rows in a subsequent
    // find after the updates.
    const targetOffers = await manager.find(Offer, {
      where: {
        candidate_user_id: candidateUserId,
        role_id: In(roleIds),
        status: OfferStatus.ASSESSMENT_UNLOCKED,
      },
      select: ['id', 'employer_user_id', 'candidate_user_id', 'role_title'],
    });

    if (targetOffers.length === 0) {
      return [];
    }

    const targetIds = targetOffers.map((o) => o.id);

    // Two-step transition: UNLOCKED → COMPLETED → PASSED/FAILED
    await manager.update(
      Offer,
      { id: In(targetIds), status: OfferStatus.ASSESSMENT_UNLOCKED },
      { status: OfferStatus.ASSESSMENT_COMPLETED },
    );

    const finalStatus = passed ? OfferStatus.PASSED : OfferStatus.FAILED;
    await manager.update(
      Offer,
      { id: In(targetIds), status: OfferStatus.ASSESSMENT_COMPLETED },
      { status: finalStatus },
    );

    return targetOffers;
  }

  private async notifyAssessmentResult(
    updatedOffers: OfferNotificationRow[],
    candidateUserId: string,
    passed: boolean,
    score: number,
    candidateName: string,
  ): Promise<void> {
    for (const offer of updatedOffers) {
      const resultPayload = {
        offerId: offer.id,
        candidateUserId,
        candidateName,
        employerUserId: offer.employer_user_id,
        roleTitle: offer.role_title,
        score,
      };

      try {
        if (passed) {
          await this.notificationDispatch.notifyAssessmentPassed(
            offer.employer_user_id,
            resultPayload,
          );
          await this.notificationDispatch.notifyAssessmentPassed(
            candidateUserId,
            resultPayload,
          );
        } else {
          await this.notificationDispatch.notifyAssessmentFailed(
            candidateUserId,
            resultPayload,
          );
        }
      } catch (notifyError: unknown) {
        this.logger.error(
          `Assessment result notification failed offer=${offer.id}: ${String(notifyError)}`,
        );
      }
    }
  }

  async listResults(
    employerUserId: string,
    assessmentId: string,
    query: ListEmployerAssessmentResultsQueryDto,
  ) {
    await this.ensureVerifiedEmployer(employerUserId);
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, employer_user_id: employerUserId },
    });
    if (!assessment) {
      throw new NotFoundError('Assessment not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = { assessment_id: assessmentId };
    if (query.status) {
      where.passed = query.status === 'pass';
    }

    const [submissions, total] = await this.submissionRepo.findAndCount({
      where,
      relations: ['candidate'],
      order: { completed_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      submissions: submissions.map((submission) => ({
        id: submission.id,
        candidateUserId: submission.candidate_user_id,
        candidateName: submission.candidate
          ? `${submission.candidate.first_name ?? ''} ${
              submission.candidate.last_name ?? ''
            }`.trim()
          : null,
        score: submission.score,
        status: submission.passed ? 'pass' : 'fail',
        timeTakenSeconds: submission.time_taken_seconds,
        dateCompleted: submission.completed_at,
        deliveryMode: submission.delivery_mode,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      emptyState:
        total === 0
          ? 'No submissions yet. Share your assessment link or send it to candidates to get started.'
          : null,
    };
  }

  async searchCandidates(
    employerUserId: string,
    query: SearchAssessmentCandidatesQueryDto,
  ) {
    await this.ensureVerifiedEmployer(employerUserId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.savedCandidateRepo
      .createQueryBuilder('saved')
      .innerJoin(User, 'u', 'u.id = saved.candidate_user_id')
      .where('saved.employer_user_id = :employerUserId', { employerUserId });

    if (query.search) {
      qb.andWhere(
        `(u.first_name ILIKE :search OR u.last_name ILIKE :search OR CONCAT(u.first_name, ' ', u.last_name) ILIKE :search)`,
        { search: `%${query.search}%` },
      );
    }

    const total = await qb.getCount();
    const rows = await qb
      .select([
        'saved.candidate_user_id AS "candidateUserId"',
        'u.first_name AS "firstName"',
        'u.last_name AS "lastName"',
        'u.email AS "email"',
      ])
      .orderBy('saved.created_at', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<{
        candidateUserId: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
      }>();

    return {
      candidates: rows.map((row) => ({
        candidateUserId: row.candidateUserId,
        fullName: `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
        email: row.email,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  validateUploadedQuestionFile(
    file: Express.Multer.File | undefined,
  ): QuestionImportValidationResult {
    if (!file) {
      throw new BadRequestError(
        "We couldn't read this file. Please use the CredLane template and try again.",
      );
    }
    if (file.size > EMPLOYER_ASSESSMENT_IMPORT_MAX_FILE_BYTES) {
      throw new BadRequestError(ErrorMessages.ONBOARDING.FILE_TOO_LARGE);
    }
    const lowerName = file.originalname.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx')) {
      throw new BadRequestError(
        "We couldn't read this file. Please use the CredLane template and try again.",
      );
    }
    const rows = lowerName.endsWith('.xlsx')
      ? this.parseXlsx(file.buffer)
      : this.parseCsv(file.buffer.toString('utf8'));
    if (rows.length < 2) {
      throw new BadRequestError(
        "We couldn't read this file. Please use the CredLane template and try again.",
      );
    }

    const header = rows[0].map((column) => column.trim());
    const missingColumns = TEMPLATE_COLUMNS.filter(
      (column) => !header.includes(column),
    );
    if (missingColumns.length > 0) {
      throw new BadRequestError(
        `Missing required columns: ${missingColumns.join(', ')}`,
      );
    }

    const columnIndex = new Map(header.map((column, index) => [column, index]));
    const questions = rows
      .slice(1)
      .filter((row) => row.some((cell) => cell.trim().length > 0))
      .map((row, index) => this.mapCsvQuestionRow(row, index + 2, columnIndex));

    return {
      status: 'success',
      questions,
      questionCount: questions.length,
    };
  }

  getTemplateCsv(): string {
    return `${TEMPLATE_COLUMNS.join(',')}\n"Which option best answers the question?","Multiple Choice","Option 1","Option 2","Option 3","Option 4","Option 1"\n"The statement is true.","True/False","True","False","","","True"\n"Explain what REST APIs are.","Short Answer","","","","","Representational state transfer APIs"\n"Which HTTP status means unauthorized?","Multiple Choice","200","201","401","500","401"\n"PostgreSQL is a relational database.","True/False","True","False","","","True"\n`;
  }

  getTemplateXlsx(): Buffer {
    const rows = [
      TEMPLATE_COLUMNS,
      [
        'Which option best answers the question?',
        'Multiple Choice',
        'Option 1',
        'Option 2',
        'Option 3',
        'Option 4',
        'Option 1',
      ],
      ['The statement is true.', 'True/False', 'True', 'False', '', '', 'True'],
      [
        'Explain what REST APIs are.',
        'Short Answer',
        '',
        '',
        '',
        '',
        'Representational state transfer APIs',
      ],
      [
        'Which HTTP status means unauthorized?',
        'Multiple Choice',
        '200',
        '201',
        '401',
        '500',
        '401',
      ],
      [
        'PostgreSQL is a relational database.',
        'True/False',
        'True',
        'False',
        '',
        '',
        'True',
      ],
    ];
    return this.buildXlsx(rows);
  }

  private async ensureVerifiedEmployer(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('Employer not found');
    }
    if (!user.is_verified) {
      throw new ForbiddenError('Only verified employers can use assessments');
    }
  }

  private async lockEmployerForAssessmentCreation(
    manager: EntityManager,
    userId: string,
  ): Promise<void> {
    const user = await manager
      .getRepository(User)
      .createQueryBuilder('user')
      .setLock('pessimistic_write')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new NotFoundError('Employer not found');
    }
    if (!user.is_verified) {
      throw new ForbiddenError('Only verified employers can use assessments');
    }
  }

  private async buildQuestionsFromCredLaneBank(
    dto: CreateEmployerAssessmentDto,
  ): Promise<EmployerAssessmentQuestionInputDto[]> {
    const level = this.mapExperienceLevelToVerifiedLevel(dto.experienceLevel);
    const bankQuestions = await this.bankQuestionRepo.find({
      where: {
        assessment_type: AssessmentType.SKILL,
        track: dto.roleTrack,
        verified_level: level,
        is_live: true,
      },
      order: { question_number: 'ASC' },
      take: 10,
    });

    if (bankQuestions.length < MIN_COMPANY_QUESTIONS) {
      throw new BadRequestError(
        'Not enough CredLane question bank questions for the selected role track and experience level',
      );
    }

    return bankQuestions.map((question) => ({
      questionText: question.question_text,
      questionType: this.mapBankQuestionType(question.question_type),
      options: question.options ?? undefined,
      correctAnswer: question.correct_answer ?? '',
    }));
  }

  private mapExperienceLevelToVerifiedLevel(
    level: EmployerAssessmentExperienceLevel,
  ): VerifiedLevel {
    const mapping: Record<EmployerAssessmentExperienceLevel, VerifiedLevel> = {
      [EmployerAssessmentExperienceLevel.JUNIOR]: VerifiedLevel.JUNIOR,
      [EmployerAssessmentExperienceLevel.MID]: VerifiedLevel.MID,
      [EmployerAssessmentExperienceLevel.SENIOR]: VerifiedLevel.SENIOR,
    };
    return mapping[level];
  }

  private normalizeCompanyQuestions(
    questions: EmployerAssessmentQuestionInputDto[],
  ): EmployerAssessmentQuestionInputDto[] {
    return questions.map((question) => ({
      questionText: question.questionText.trim(),
      questionType: question.questionType,
      options: this.isTextAnswerQuestion(question.questionType)
        ? undefined
        : question.options?.map((option) => option.trim()).filter(Boolean),
      correctAnswer: question.correctAnswer.trim(),
    }));
  }

  private mapBankQuestionType(
    questionType: QuestionType,
  ): EmployerQuestionType {
    if (questionType === QuestionType.REQUIRED_TEXT) {
      return EmployerQuestionType.SHORT_ANSWER;
    }
    return EmployerQuestionType.MULTIPLE_CHOICE;
  }

  private async notifyCandidates(
    assessment: EmployerAssessment,
    candidateUserIds: string[],
  ): Promise<void> {
    const users = await this.userRepo.findBy({ id: In(candidateUserIds) });
    const validIds = new Set(users.map((user) => user.id));

    const results = await Promise.allSettled(
      candidateUserIds
        .filter((candidateUserId) => {
          if (!validIds.has(candidateUserId)) {
            this.logger.warn(
              `Assessment invite notification skipped; candidate not found: ${candidateUserId}`,
            );
            return false;
          }
          return true;
        })
        .map((candidateUserId) =>
          this.notificationDispatch.dispatch(
            NotificationType.ASSESSMENT_RECEIVED,
            candidateUserId,
            {
              assessmentId: assessment.id,
              title: assessment.title,
              roleTrack: assessment.role_track,
              shareUrl: this.buildShareUrl(assessment.share_token),
            },
          ),
        ),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(
          `Assessment invite notification failed: ${String(result.reason)}`,
        );
      }
    }
  }

  private buildShareUrl(token: string): string {
    const baseUrl =
      process.env.FRONTEND_URL?.replace(/\/$/, '') ?? 'https://credlane.com';
    return `${baseUrl}/assessments/${token}`;
  }

  private parseCsv(csv: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let value = '';
    let inQuotes = false;

    for (let index = 0; index < csv.length; index += 1) {
      const char = csv[index];
      const next = csv[index + 1];
      if (char === '"' && inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(value);
        value = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') {
          index += 1;
        }
        row.push(value);
        rows.push(row);
        row = [];
        value = '';
      } else {
        value += char;
      }
    }

    if (value.length > 0 || row.length > 0) {
      row.push(value);
      rows.push(row);
    }

    return rows;
  }

  private parseXlsx(buffer: Buffer): string[][] {
    try {
      const entries = this.readZipEntries(buffer);
      const workbookRels = entries.get('xl/_rels/workbook.xml.rels');
      const workbook = entries.get('xl/workbook.xml');
      const sheetPath = this.resolveFirstSheetPath(workbook, workbookRels);
      const sheetXml = entries.get(sheetPath);
      if (!sheetXml) {
        throw new Error('sheet not found');
      }
      const sharedStrings = this.parseSharedStrings(
        entries.get('xl/sharedStrings.xml') ?? '',
      );
      return this.parseSheetRows(sheetXml, sharedStrings);
    } catch {
      throw new BadRequestError(
        "We couldn't read this file. Please use the CredLane template and try again.",
      );
    }
  }

  private readZipEntries(buffer: Buffer): Map<string, string> {
    const entries = new Map<string, string>();
    let eocdOffset = -1;
    for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
      if (buffer.readUInt32LE(offset) === 0x06054b50) {
        eocdOffset = offset;
        break;
      }
    }
    if (eocdOffset < 0) {
      throw new Error('zip eocd not found');
    }

    const entryCount = buffer.readUInt16LE(eocdOffset + 10);
    let centralOffset = buffer.readUInt32LE(eocdOffset + 16);
    for (let index = 0; index < entryCount; index += 1) {
      if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) {
        throw new Error('invalid central directory');
      }
      const method = buffer.readUInt16LE(centralOffset + 10);
      const compressedSize = buffer.readUInt32LE(centralOffset + 20);
      const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
      const extraLength = buffer.readUInt16LE(centralOffset + 30);
      const commentLength = buffer.readUInt16LE(centralOffset + 32);
      const localOffset = buffer.readUInt32LE(centralOffset + 42);
      const fileName = buffer
        .subarray(centralOffset + 46, centralOffset + 46 + fileNameLength)
        .toString('utf8');

      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(
        dataOffset,
        dataOffset + compressedSize,
      );
      const content =
        method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed);
      entries.set(fileName, content.toString('utf8'));
      centralOffset += 46 + fileNameLength + extraLength + commentLength;
    }
    return entries;
  }

  private resolveFirstSheetPath(
    workbookXml: string | undefined,
    relsXml: string | undefined,
  ): string {
    if (!workbookXml || !relsXml) {
      return 'xl/worksheets/sheet1.xml';
    }
    const workbookRelationshipId =
      workbookXml.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1] ?? 'rId1';
    const relationshipId = /^rId\d+$/.test(workbookRelationshipId)
      ? workbookRelationshipId
      : 'rId1';
    const relationshipMatch = relsXml.match(
      new RegExp(
        `<Relationship[^>]*Id="${relationshipId}"[^>]*Target="([^"]+)"`,
      ),
    );
    const target = relationshipMatch?.[1] ?? 'worksheets/sheet1.xml';
    return target.startsWith('xl/') ? target : `xl/${target}`;
  }

  private parseSharedStrings(xml: string): string[] {
    return [...xml.matchAll(/<si\b[\s\S]*?<\/si>/g)].map((match) =>
      this.decodeXml(
        [...match[0].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
          .map((textMatch) => textMatch[1])
          .join(''),
      ),
    );
  }

  private parseSheetRows(xml: string, sharedStrings: string[]): string[][] {
    return [...xml.matchAll(/<row\b[^>]*>[\s\S]*?<\/row>/g)].map((rowMatch) => {
      const values: string[] = [];
      for (const cellMatch of rowMatch[0].matchAll(
        /<c\b([^>]*)>([\s\S]*?)<\/c>/g,
      )) {
        const attributes = cellMatch[1];
        const body = cellMatch[2];
        const ref = attributes.match(/r="([A-Z]+)\d+"/)?.[1] ?? 'A';
        const columnIndex = this.columnNameToIndex(ref);
        const type = attributes.match(/t="([^"]+)"/)?.[1];
        const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
        const inlineValue =
          body.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/)?.[1] ?? '';
        values[columnIndex] =
          type === 's'
            ? (sharedStrings[Number(rawValue)] ?? '')
            : this.decodeXml(inlineValue || rawValue);
      }
      return values;
    });
  }

  private columnNameToIndex(columnName: string): number {
    return (
      [...columnName].reduce(
        (total, char) => total * 26 + char.charCodeAt(0) - 64,
        0,
      ) - 1
    );
  }

  private buildXlsx(rows: string[][]): Buffer {
    const files = new Map<string, string>([
      [
        '[Content_Types].xml',
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
      ],
      [
        '_rels/.rels',
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      ],
      [
        'xl/workbook.xml',
        '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Questions" sheetId="1" r:id="rId1"/></sheets></workbook>',
      ],
      [
        'xl/_rels/workbook.xml.rels',
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      ],
      ['xl/worksheets/sheet1.xml', this.buildWorksheetXml(rows)],
    ]);
    return this.buildZip(files);
  }

  private buildWorksheetXml(rows: string[][]): string {
    const sheetRows = rows
      .map((row, rowIndex) => {
        const cells = row
          .map((value, columnIndex) => {
            const ref = `${this.indexToColumnName(columnIndex)}${rowIndex + 1}`;
            return `<c r="${ref}" t="inlineStr"><is><t>${this.escapeXml(
              value,
            )}</t></is></c>`;
          })
          .join('');
        return `<row r="${rowIndex + 1}">${cells}</row>`;
      })
      .join('');
    return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
  }

  private indexToColumnName(index: number): string {
    let name = '';
    let remaining = index;
    while (remaining >= 0) {
      name = XLSX_COLUMN_ALPHABET[remaining % 26] + name;
      remaining = Math.floor(remaining / 26) - 1;
    }
    return name;
  }

  private buildZip(files: Map<string, string>): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;
    for (const [name, content] of files) {
      const nameBuffer = Buffer.from(name);
      const data = Buffer.from(content);
      const crc = this.crc32(data);
      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0, 6);
      localHeader.writeUInt16LE(0, 8);
      localHeader.writeUInt32LE(crc, 14);
      localHeader.writeUInt32LE(data.length, 18);
      localHeader.writeUInt32LE(data.length, 22);
      localHeader.writeUInt16LE(nameBuffer.length, 26);
      localParts.push(localHeader, nameBuffer, data);

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0, 8);
      centralHeader.writeUInt16LE(0, 10);
      centralHeader.writeUInt32LE(crc, 16);
      centralHeader.writeUInt32LE(data.length, 20);
      centralHeader.writeUInt32LE(data.length, 24);
      centralHeader.writeUInt16LE(nameBuffer.length, 28);
      centralHeader.writeUInt32LE(offset, 42);
      centralParts.push(centralHeader, nameBuffer);
      offset += localHeader.length + nameBuffer.length + data.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.size, 8);
    end.writeUInt16LE(files.size, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...localParts, centralDirectory, end]);
  }

  private crc32(data: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private decodeXml(value: string): string {
    return value
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
  }

  private mapCsvQuestionRow(
    row: string[],
    rowNumber: number,
    columnIndex: Map<string, number>,
  ): EmployerAssessmentQuestionInputDto {
    const read = (column: string) =>
      row[columnIndex.get(column) ?? -1]?.trim() ?? '';
    const questionText = read('Question Text');
    const rawType = read('Question Type');
    const correctAnswer = read('Correct Answer');

    if (!questionText) {
      throw new BadRequestError(
        `Row ${rowNumber} is missing question text. Please fix and re-upload.`,
      );
    }

    if (!correctAnswer) {
      throw new BadRequestError(
        `Row ${rowNumber} is missing a correct answer. Please fix and re-upload.`,
      );
    }

    const questionType = this.normalizeUploadedQuestionType(rawType, rowNumber);
    const options = ['Option A', 'Option B', 'Option C', 'Option D']
      .map(read)
      .filter(Boolean);

    if (!this.isTextAnswerQuestion(questionType) && options.length < 2) {
      throw new BadRequestError(
        `Row ${rowNumber} needs at least two answer options. Please fix and re-upload.`,
      );
    }

    return {
      questionText,
      questionType,
      options: this.isTextAnswerQuestion(questionType) ? undefined : options,
      correctAnswer,
    };
  }

  private isTextAnswerQuestion(questionType: EmployerQuestionType): boolean {
    return questionType === EmployerQuestionType.SHORT_ANSWER;
  }

  private normalizeUploadedQuestionType(
    rawType: string,
    rowNumber: number,
  ): EmployerQuestionType {
    const normalized = rawType.trim().toLowerCase();
    if (['multiple choice', 'multiple_choice'].includes(normalized)) {
      return EmployerQuestionType.MULTIPLE_CHOICE;
    }
    if (['true/false', 'true_false', 'true false'].includes(normalized)) {
      return EmployerQuestionType.TRUE_FALSE;
    }
    if (['short answer', 'short_answer'].includes(normalized)) {
      return EmployerQuestionType.SHORT_ANSWER;
    }
    throw new BadRequestError(
      `Row ${rowNumber} has an unsupported question type. Please fix and re-upload.`,
    );
  }
}
