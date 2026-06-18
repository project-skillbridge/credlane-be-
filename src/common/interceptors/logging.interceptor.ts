import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { Observable, tap } from 'rxjs';
import { normaliseRoute } from '../utils/normalise-route';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url } = request;
    const route = normaliseRoute(url);
    const requestId = request.requestId;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - start;
        this.logger.info(
          {
            requestId,
            method,
            route,
            status: response.statusCode,
            durationMs,
          },
          'Request completed',
        );
      }),
    );
  }
}
