import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { SuccessMessages } from '../../shared';

export const SKIP_API_TRANSFORM_KEY = 'skipApiTransform';
export const SkipApiTransform = () => SetMetadata(SKIP_API_TRANSFORM_KEY, true);

type MessagePayload = {
  message: string;
} & Record<string, unknown>;

type PaginatedPayload<T> = {
  paginationMeta: Record<string, unknown>;
  payload: T;
} & Record<string, unknown>;

export type ApiResponse<T> = {
  status_code: number;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
} & Record<string, unknown>;

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T> | T
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    const skipTransform = this.reflector.getAllAndOverride<boolean>(
      SKIP_API_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipTransform) {
      return next.handle();
    }

    const response = context
      .switchToHttp()
      .getResponse<{ statusCode: number }>();
    return next.handle().pipe(
      map((payload) => {
        const statusCode = response.statusCode;
        const baseResponse = {
          status_code: statusCode,
          message: SuccessMessages.COMMON.SUCCESS,
        };

        if (
          payload &&
          typeof payload === 'object' &&
          'paginationMeta' in (payload as object)
        ) {
          const {
            paginationMeta,
            payload: data,
            ...rest
          } = payload as PaginatedPayload<T>;
          return {
            ...baseResponse,
            data,
            meta: { ...rest, ...paginationMeta },
          };
        }

        if (
          payload &&
          typeof payload === 'object' &&
          !Array.isArray(payload) &&
          'message' in payload
        ) {
          const { message, ...data } = payload as MessagePayload;
          return {
            status_code: statusCode,
            message: String(message),
            ...data,
          };
        }

        return { ...baseResponse, data: payload };
      }),
    );
  }
}
