import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import {
  keysToCamel,
  REQUEST_CASE_TRANSFORM_OPTIONS,
} from '../utils/case-transform';

@Injectable()
export class CaseTransformMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CaseTransformMiddleware.name);

  use(req: Request, _res: Response, next: NextFunction): void {
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      try {
        req.body = keysToCamel(
          req.body as Record<string, unknown>,
          REQUEST_CASE_TRANSFORM_OPTIONS,
        );
      } catch (err) {
        this.logger.error(
          'Failed to transform request body keys to camelCase',
          err,
        );
        return next(err);
      }
    }

    if (req.query && typeof req.query === 'object') {
      try {
        this.applyCamelCaseToQuery(req);
      } catch (err) {
        this.logger.error(
          'Failed to transform request query keys to camelCase',
          err,
        );
        return next(err);
      }
    }

    next();
  }

  /**
   * Express 5 defines `req.query` as a getter-only property.
   * Override the descriptor so downstream code sees the transformed value.
   */
  private applyCamelCaseToQuery(req: Request): void {
    const camelQuery = keysToCamel(req.query, REQUEST_CASE_TRANSFORM_OPTIONS);
    Object.defineProperty(req, 'query', {
      value: camelQuery,
      writable: true,
      configurable: true,
    });
  }
}
