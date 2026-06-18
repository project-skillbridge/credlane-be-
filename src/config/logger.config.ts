import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import { trace } from '@opentelemetry/api';

const isProduction = process.env.NODE_ENV === 'production';

export const loggerConfig: Params = {
  pinoHttp: {
    level: isProduction ? 'info' : 'debug',
    autoLogging: false,
    transport: isProduction
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            colorize: true,
          },
        },
    genReqId: (_req: IncomingMessage, res: ServerResponse) => {
      const requestId = randomUUID();
      res.setHeader('x-request-id', requestId);
      return requestId;
    },
    customProps: (req: IncomingMessage) => {
      const base = {
        requestId: (req as IncomingMessage & { id?: string }).id,
      };
      const span = trace.getActiveSpan();
      if (!span?.isRecording()) return base;
      const { traceId, spanId } = span.spanContext();
      return { ...base, traceId, spanId };
    },
  },
};
