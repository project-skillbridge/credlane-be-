jest.mock('./advanced-assessment-submit.processor', () => ({
  AdvancedAssessmentSubmitProcessor: jest.fn(),
}));

import { advancedAssessmentSubmitJobSchema } from './advanced-assessment-submit.types';
import { AdvancedAssessmentQueueService } from './advanced-assessment-queue.service';

describe('advancedAssessmentSubmitJobSchema', () => {
  it('accepts a valid submit payload', () => {
    const parsed = advancedAssessmentSubmitJobSchema.safeParse({
      userId: '11111111-1111-4111-8111-111111111111',
      sessionId: '22222222-2222-4222-8222-222222222222',
      answers: [
        {
          question_id: '33333333-3333-4333-8333-333333333333',
          answer: 'Option A',
          time_spent_seconds: 30,
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
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it('enqueue delegates to inline processor when Redis is unset', async () => {
    delete process.env.REDIS_URL;

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
          question_id: '33333333-3333-4333-8333-333333333333',
          answer: 'hello',
        },
      ],
    };

    queue.enqueue(payload);
    await queue.awaitIdleForTests();

    expect(processJob).toHaveBeenCalledWith(payload);
  });
});
