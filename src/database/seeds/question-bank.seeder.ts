import { DataSource } from 'typeorm';
import {
  AssessmentQuestion,
  AssessmentType,
  QuestionType,
  SlotType,
} from '../../modules/assessments/entities/assessment-question.entity';
import { Seeder } from './seeder.interface';

type Difficulty = 'easy' | 'medium' | 'hard';
type AnswerBlock = 'short_text' | 'long_text';

type QuestionSeed = {
  question_text: string;
  question_type: QuestionType;
  options?: string[] | null;
  correct_answer?: string | null;
  slot_type: SlotType;
  metadata: Record<string, unknown>;
};

const buildMetadata = (
  difficulty: Difficulty,
  estimatedTimeSeconds: number,
  tags: string[],
  answerBlock: AnswerBlock = 'short_text',
) => ({
  difficulty,
  estimated_time_seconds: estimatedTimeSeconds,
  tags,
  answer_block: answerBlock,
});

const questionSeeds: QuestionSeed[] = [
  {
    question_text:
      'Which HTTP status code is most appropriate for a successful POST that creates a new resource?',
    question_type: QuestionType.SINGLE_PICK,
    options: ['200 OK', '201 Created', '204 No Content', '302 Found'],
    correct_answer: '201 Created',
    slot_type: SlotType.WORK_TASK,
    metadata: buildMetadata('easy', 45, ['http', 'rest']),
  },
  {
    question_text:
      'Which PostgreSQL index type is most appropriate for range queries (for example, BETWEEN or > / <)?',
    question_type: QuestionType.SINGLE_PICK,
    options: ['Hash', 'B-tree', 'GIN', 'BRIN'],
    correct_answer: 'B-tree',
    slot_type: SlotType.WORK_TASK,
    metadata: buildMetadata('easy', 60, ['postgres', 'indexes']),
  },
  {
    question_text:
      'Which TypeScript utility type makes all properties of a type optional?',
    question_type: QuestionType.SINGLE_PICK,
    options: ['Partial<T>', 'Pick<T>', 'Required<T>', 'Omit<T>'],
    correct_answer: 'Partial<T>',
    slot_type: SlotType.REFLECTION,
    metadata: buildMetadata('easy', 45, ['typescript', 'types']),
  },
  {
    question_text:
      'Which Git command creates and switches to a new branch named feature/login?',
    question_type: QuestionType.SINGLE_PICK,
    options: [
      'git branch feature/login',
      'git checkout -b feature/login',
      'git switch --detach feature/login',
      'git merge feature/login',
    ],
    correct_answer: 'git checkout -b feature/login',
    slot_type: SlotType.WORK_TASK,
    metadata: buildMetadata('easy', 45, ['git', 'workflow']),
  },
  {
    question_text: 'Which HTTP method is idempotent by definition?',
    question_type: QuestionType.SINGLE_PICK,
    options: ['POST', 'PUT', 'PATCH', 'CONNECT'],
    correct_answer: 'PUT',
    slot_type: SlotType.SITUATIONAL,
    metadata: buildMetadata('easy', 45, ['http', 'api']),
  },
  {
    question_text:
      'In Node.js, which event loop phase executes callbacks scheduled by setTimeout?',
    question_type: QuestionType.SINGLE_PICK,
    options: ['poll', 'timers', 'check', 'close callbacks'],
    correct_answer: 'timers',
    slot_type: SlotType.WORK_TASK,
    metadata: buildMetadata('medium', 60, ['nodejs', 'event-loop']),
  },
  {
    question_text:
      'Which SQL clause filters aggregated results after GROUP BY has been applied?',
    question_type: QuestionType.SINGLE_PICK,
    options: ['WHERE', 'HAVING', 'ORDER BY', 'DISTINCT'],
    correct_answer: 'HAVING',
    slot_type: SlotType.WORK_TASK,
    metadata: buildMetadata('easy', 45, ['sql', 'aggregation']),
  },
  {
    question_text: 'In JWT, which section contains the claims?',
    question_type: QuestionType.SINGLE_PICK,
    options: ['Header', 'Payload', 'Signature', 'Footer'],
    correct_answer: 'Payload',
    slot_type: SlotType.REFLECTION,
    metadata: buildMetadata('easy', 45, ['jwt', 'auth']),
  },
  {
    question_text:
      'Which HTTP header tells the client the media type of the response body?',
    question_type: QuestionType.SINGLE_PICK,
    options: ['Accept', 'Content-Type', 'Authorization', 'Cache-Control'],
    correct_answer: 'Content-Type',
    slot_type: SlotType.SITUATIONAL,
    metadata: buildMetadata('easy', 45, ['http', 'headers']),
  },
  {
    question_text: 'What is the primary benefit of using database transactions?',
    question_type: QuestionType.SINGLE_PICK,
    options: [
      'Faster queries',
      'All-or-nothing changes',
      'Automatic indexing',
      'Reduced storage',
    ],
    correct_answer: 'All-or-nothing changes',
    slot_type: SlotType.REFLECTION,
    metadata: buildMetadata('easy', 45, ['database', 'transactions']),
  },
  {
    question_text: 'Which Docker command lists running containers?',
    question_type: QuestionType.SINGLE_PICK,
    options: ['docker images', 'docker ps', 'docker run', 'docker logs'],
    correct_answer: 'docker ps',
    slot_type: SlotType.WORK_TASK,
    metadata: buildMetadata('easy', 45, ['docker', 'devops']),
  },
  {
    question_text: 'Which HTTP method is used for CORS preflight requests?',
    question_type: QuestionType.SINGLE_PICK,
    options: ['GET', 'POST', 'OPTIONS', 'TRACE'],
    correct_answer: 'OPTIONS',
    slot_type: SlotType.SITUATIONAL,
    metadata: buildMetadata('easy', 45, ['cors', 'http']),
  },
  {
    question_text:
      'In TypeScript, which type requires you to narrow before you can access properties?',
    question_type: QuestionType.SINGLE_PICK,
    options: ['any', 'unknown', 'never', 'void'],
    correct_answer: 'unknown',
    slot_type: SlotType.REFLECTION,
    metadata: buildMetadata('easy', 45, ['typescript', 'safety']),
  },
  {
    question_text: 'What is the safest way to store user passwords?',
    question_type: QuestionType.SINGLE_PICK,
    options: [
      'Plain text with an encryption key',
      'Reversible encryption',
      'Salted hash (bcrypt or argon2)',
      'Base64 encoding',
    ],
    correct_answer: 'Salted hash (bcrypt or argon2)',
    slot_type: SlotType.SITUATIONAL,
    metadata: buildMetadata('easy', 45, ['security', 'auth']),
  },
  {
    question_text:
      'In a TypeORM QueryBuilder, which method loads relations in the same query?',
    question_type: QuestionType.SINGLE_PICK,
    options: [
      'leftJoinAndSelect',
      'addSelect',
      'loadRelationCountAndMap',
      'update',
    ],
    correct_answer: 'leftJoinAndSelect',
    slot_type: SlotType.WORK_TASK,
    metadata: buildMetadata('medium', 60, ['typeorm', 'orm']),
  },
  {
    question_text:
      'Describe how you would make a POST /orders endpoint idempotent.',
    question_type: QuestionType.REQUIRED_TEXT,
    options: null,
    correct_answer: null,
    slot_type: SlotType.SITUATIONAL,
    metadata: buildMetadata(
      'medium',
      120,
      ['api', 'idempotency', 'reliability'],
      'short_text',
    ),
  },
  {
    question_text:
      'When a background job fails intermittently, what logging or metrics would you add to troubleshoot?',
    question_type: QuestionType.REQUIRED_TEXT,
    options: null,
    correct_answer: null,
    slot_type: SlotType.REFLECTION,
    metadata: buildMetadata(
      'easy',
      90,
      ['observability', 'queues'],
      'short_text',
    ),
  },
  {
    question_text:
      'Explain how you would handle versioning for a public API that is already in use.',
    question_type: QuestionType.REQUIRED_TEXT,
    options: null,
    correct_answer: null,
    slot_type: SlotType.REFLECTION,
    metadata: buildMetadata(
      'medium',
      120,
      ['api', 'versioning'],
      'short_text',
    ),
  },
  {
    question_text:
      'What steps would you take to mitigate a slow database query in production?',
    question_type: QuestionType.REQUIRED_TEXT,
    options: null,
    correct_answer: null,
    slot_type: SlotType.WORK_TASK,
    metadata: buildMetadata(
      'medium',
      120,
      ['database', 'performance'],
      'short_text',
    ),
  },
  {
    question_text:
      'How would you design a retry strategy for outbound HTTP calls to a flaky service?',
    question_type: QuestionType.REQUIRED_TEXT,
    options: null,
    correct_answer: null,
    slot_type: SlotType.SITUATIONAL,
    metadata: buildMetadata(
      'medium',
      120,
      ['resilience', 'http'],
      'short_text',
    ),
  },
  {
    question_text:
      'Design a scalable file upload pipeline for large files that includes virus scanning and progress reporting.',
    question_type: QuestionType.OPTIONAL_TEXT,
    options: null,
    correct_answer: null,
    slot_type: SlotType.WORK_TASK,
    metadata: buildMetadata(
      'hard',
      420,
      ['architecture', 'uploads', 'security'],
      'long_text',
    ),
  },
  {
    question_text:
      'Explain how you would implement a multi-tenant SaaS with data isolation and per-tenant rate limits.',
    question_type: QuestionType.OPTIONAL_TEXT,
    options: null,
    correct_answer: null,
    slot_type: SlotType.WORK_TASK,
    metadata: buildMetadata(
      'hard',
      420,
      ['multi-tenant', 'architecture', 'security'],
      'long_text',
    ),
  },
  {
    question_text:
      'Given a monolith with growing load, outline a migration plan to a modular or microservice architecture.',
    question_type: QuestionType.OPTIONAL_TEXT,
    options: null,
    correct_answer: null,
    slot_type: SlotType.REFLECTION,
    metadata: buildMetadata(
      'hard',
      420,
      ['architecture', 'migration'],
      'long_text',
    ),
  },
  {
    question_text:
      'Design the data model and API endpoints for a real-time collaborative editor.',
    question_type: QuestionType.OPTIONAL_TEXT,
    options: null,
    correct_answer: null,
    slot_type: SlotType.SITUATIONAL,
    metadata: buildMetadata(
      'hard',
      480,
      ['realtime', 'collaboration', 'websockets'],
      'long_text',
    ),
  },
  {
    question_text:
      'Describe how you would ensure end-to-end reliability for a payment workflow, including retries, idempotency, and reconciliation.',
    question_type: QuestionType.OPTIONAL_TEXT,
    options: null,
    correct_answer: null,
    slot_type: SlotType.SITUATIONAL,
    metadata: buildMetadata(
      'hard',
      420,
      ['payments', 'reliability'],
      'long_text',
    ),
  },
];

export const questionBankSeeder: Seeder = {
  name: 'QuestionBankSeeder',
  async run(dataSource: DataSource) {
    const repository = dataSource.getRepository(AssessmentQuestion);
    const texts = questionSeeds.map((seed) => seed.question_text);
    const existingRows = await repository
      .createQueryBuilder('question')
      .select('question.question_text', 'question_text')
      .where('question.assessment_type = :assessmentType', {
        assessmentType: AssessmentType.ADVANCED,
      })
      .andWhere('question.question_text IN (:...texts)', { texts })
      .getRawMany();

    const existing = new Set(
      existingRows.map((row) => String(row.question_text).trim().toLowerCase()),
    );

    const maxRow = await repository
      .createQueryBuilder('question')
      .select('MAX(question.question_number)', 'max')
      .where('question.assessment_type = :assessmentType', {
        assessmentType: AssessmentType.ADVANCED,
      })
      .getRawOne();

    const startNumber = Number(maxRow?.max ?? 0) + 1;
    let nextNumber = startNumber;

    const pending = questionSeeds
      .filter((seed) => !existing.has(seed.question_text.trim().toLowerCase()))
      .map((seed) =>
        repository.create({
          assessment_type: AssessmentType.ADVANCED,
          question_type: seed.question_type,
          question_text: seed.question_text,
          question_number: nextNumber++,
          options: seed.options ?? null,
          correct_answer: seed.correct_answer ?? null,
          track: null,
          verified_level: null,
          competency: null,
          slot_type: seed.slot_type,
          metadata: seed.metadata,
          is_live: true,
        }),
      );

    if (pending.length === 0) {
      console.log('[QuestionBankSeeder] no new questions to insert - skipping');
      return;
    }

    await repository.save(pending);
    console.log(`[QuestionBankSeeder] inserted ${pending.length} questions`);
  },
};
