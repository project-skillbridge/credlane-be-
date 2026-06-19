import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MulterError } from 'multer';
import { PinoLogger } from 'nestjs-pino';
import { ErrorMessages } from '../../shared';
import { normaliseRoute } from '../utils/normalise-route';

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(HttpExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = ErrorMessages.COMMON.INTERNAL_SERVER_ERROR;
    let error = 'InternalServerError';
    let details: Record<string, unknown> = {};

    if (exception instanceof MulterError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      if (exception.code === 'LIMIT_FILE_SIZE') {
        message = ErrorMessages.ONBOARDING.FILE_TOO_LARGE;
      } else if (exception.code === 'LIMIT_UNEXPECTED_FILE') {
        message = `Unexpected field: ${exception.field}`;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r.message as string | string[]) ?? message;
        error = (r.error as string) ?? exception.name;
        const { message: _message, error: _error, ...rest } = r;
        details = rest;
      }
    }

    const requestId = request.requestId;
    const route = normaliseRoute(request.url);
    const logPayload = {
      requestId,
      method: request.method,
      route,
      status,
      error,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        logPayload,
        exception instanceof Error ? exception.stack : 'Internal server error',
      );
    } else if (status >= HttpStatus.BAD_REQUEST) {
      this.logger.warn(logPayload, 'Request failed');
    }

    response.status(status).json({
      success: false,
      status_code: status,
      error,
      message,
      ...details,
      path: request.url,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
