jest.mock('./advanced-assessment-submit.processor', () => ({
  AdvancedAssessmentSubmitProcessor: jest.fn(),
}));

jest.mock('../../../shared/runtime/redis-queue', () => ({
  redisQueueConnection: jest.fn(),
}));

import { redisQueueConnection } from '../../../shared/runtime/redis-queue';
import { advancedAssessmentSubmitJobSchema } from './advanced-assessment-submit.types';
import { AdvancedAssessmentQueueService } from './advanced-assessment-queue.service';

const redisQueueConnectionMock = redisQueueConnection as jest.MockedFunction<
  typeof redisQueueConnection
>;

describe('advancedAssessmentSubmitJobSchema', () => {
  it('accepts a valid submit payload', () => {
    const parsed = advancedAssessmentSubmitJobSchema.safeParse({
      userId: '11111111-1111-4111-8111-111111111111',
      sessionId: '22222222-2222-4222-8222-222222222222',
      answers: [
        {
          questionId: '33333333-3333-4333-8333-333333333333',
          answer: 'Option A',
          timeSpentSeconds: 30,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid userId', () => {
    const parsed = advancedAssessmentSubmitJobSchema.safeParse({
      userId: 'not-a-uuid',
      sessionId: '22222222-2222-4222-8222-222222222222',
      answers: [],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('AdvancedAssessmentQueueService', () => {
  beforeEach(() => {
    redisQueueConnectionMock.mockReset();
  });

  it('enqueue delegates to inline processor when Redis is unset', async () => {
    redisQueueConnectionMock.mockReturnValue(null);

    const processJob = jest.fn().mockResolvedValue(undefined);
    const queue = new AdvancedAssessmentQueueService({
      process: processJob,
    } as never);

    queue.onModuleInit();

    const payload = {
      userId: '11111111-1111-4111-8111-111111111111',
      sessionId: '22222222-2222-4222-8222-222222222222',
      answers: [
        {
          questionId: '33333333-3333-4333-8333-333333333333',
          answer: 'hello',
        },
      ],
    };

    await queue.enqueue(payload);
    await queue.awaitIdleForTests();

    expect(processJob).toHaveBeenCalledWith(payload);
  });

  it('replaces failed redis job with same session id', async () => {
    redisQueueConnectionMock.mockReturnValue({} as never);

    const queue = new AdvancedAssessmentQueueService({
      process: jest.fn(),
    } as never);

    const existingJob = {
      getState: jest.fn().mockResolvedValue('failed'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const add = jest.fn().mockResolvedValue(undefined);
    (queue as unknown as { queue: unknown }).queue = {
      getJob: jest.fn().mockResolvedValue(existingJob),
      add,
    };

    await queue.enqueue({
      userId: '11111111-1111-4111-8111-111111111111',
      sessionId: '22222222-2222-4222-8222-222222222222',
      answers: [],
    });

    expect(existingJob.remove).toHaveBeenCalled();
    expect(add).toHaveBeenCalled();
  });

  it('no-ops duplicate redis jobs while one is in flight', async () => {
    redisQueueConnectionMock.mockReturnValue({} as never);

    const queue = new AdvancedAssessmentQueueService({
      process: jest.fn(),
    } as never);

    const existingJob = {
      getState: jest.fn().mockResolvedValue('active'),
      remove: jest.fn(),
    };
    const add = jest.fn();
    (queue as unknown as { queue: unknown }).queue = {
      getJob: jest.fn().mockResolvedValue(existingJob),
      add,
    };

    await queue.enqueue({
      userId: '11111111-1111-4111-8111-111111111111',
      sessionId: '22222222-2222-4222-8222-222222222222',
      answers: [],
    });

    expect(existingJob.remove).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });
});
