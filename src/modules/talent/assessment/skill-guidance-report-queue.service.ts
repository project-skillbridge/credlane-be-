import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { redisQueueConnection } from '../../../shared/runtime/redis-queue';
import { SkillGuidanceReportProcessor } from './skill-guidance-report.processor';
import {
  skillGuidanceReportJobSchema,
  type SkillGuidanceReportJobData,
} from './skill-guidance-report.types';

const QUEUE_NAME = 'skill-guidance-report';
const JOB_NAME = 'generate-report';

@Injectable()
export class SkillGuidanceReportQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SkillGuidanceReportQueueService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private inlinePending = 0;
  private inlineIdleWaiters: Array<() => void> = [];

  constructor(private readonly processor: SkillGuidanceReportProcessor) {}

  onModuleInit(): void {
    const conn = redisQueueConnection();
    if (!conn) {
      this.logger.log(
        'REDIS_URL not set; skill guidance report runs inline after the request returns.',
      );
      return;
    }
    this.queue = new Queue(QUEUE_NAME, { connection: conn });
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        const parsed = skillGuidanceReportJobSchema.safeParse(job.data);
        if (!parsed.success) {
          this.logger.error(
            'Invalid skill guidance report job payload',
            parsed.error.flatten(),
          );
          throw new Error('Invalid skill guidance report job payload');
        }
        await this.processor.process(parsed.data);
      },
      { connection: conn },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Skill guidance report job ${job?.id} failed`,
        err instanceof Error ? err.stack : err,
      );
    });
  }

  async enqueue(payload: SkillGuidanceReportJobData): Promise<void> {
    const conn = redisQueueConnection();
    if (!conn) {
      this.inlinePending++;
      setImmediate(() => {
        void (async () => {
          try {
            const parsed = skillGuidanceReportJobSchema.safeParse(payload);
            if (!parsed.success) {
              this.logger.error(
                'Invalid inline skill guidance report payload',
                parsed.error.flatten(),
              );
              return;
            }
            await this.processor.process(parsed.data);
          } catch (err) {
            this.logger.error(
              'Inline skill guidance report failed',
              err instanceof Error ? err.stack : err,
            );
          } finally {
            this.inlinePending--;
            this.flushInlineWaiters();
          }
        })();
      });
      return;
    }

    try {
      await this.queue!.add(JOB_NAME, payload, {
        jobId: payload.attemptId,
        removeOnComplete: true,
        removeOnFail: false,
      });
    } catch (err: unknown) {
      this.logger.error(
        'Failed to enqueue skill guidance report job',
        err instanceof Error ? err.stack : err,
      );
    }
  }

  awaitIdleForTests(): Promise<void> {
    if (redisQueueConnection()) return Promise.resolve();
    if (this.inlinePending === 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.inlineIdleWaiters.push(resolve);
    });
  }

  private flushInlineWaiters(): void {
    if (this.inlinePending === 0 && this.inlineIdleWaiters.length > 0) {
      const waiters = this.inlineIdleWaiters;
      this.inlineIdleWaiters = [];
      for (const resolve of waiters) resolve();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
