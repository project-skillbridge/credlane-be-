import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Counter, Histogram } from 'prom-client';
import { Observable, tap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
});

function normaliseRoute(url: string): string {
  // Replace UUIDs and numeric IDs with a placeholder so high-cardinality
  // paths like /users/123 and /users/456 collapse to /users/:id
  return url
    .split('?')[0]
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id',
    )
    .replace(/\/\d+/g, '/:id');
}

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const method = req.method;
    const route = normaliseRoute(req.url);
    const end = httpRequestDuration.startTimer({ method, route });

    return next.handle().pipe(
      tap(() => {
        const status = String(res.statusCode);
        end({ status });
        httpRequestsTotal.inc({ method, route, status });
      }),
      catchError((err: unknown) => {
        const status =
          err instanceof HttpException ? String(err.getStatus()) : '500';
        end({ status });
        httpRequestsTotal.inc({ method, route, status });
        return throwError(() => err);
      }),
    );
  }
}
