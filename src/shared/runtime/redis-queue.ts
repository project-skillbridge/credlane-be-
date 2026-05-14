import type { ConnectionOptions } from 'bullmq';
import { env } from '../../config/env';

export function redisQueueConnection(): ConnectionOptions | null {
  const url = env.REDIS_URL?.trim();
  if (!url) return null;
  return { url };
}
