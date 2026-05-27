import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import {
  keysToCamel,
  REQUEST_CASE_TRANSFORM_OPTIONS,
} from '../utils/case-transform';

@Injectable()
export class CaseTransformMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      req.body = keysToCamel(req.body as Record<string, unknown>, REQUEST_CASE_TRANSFORM_OPTIONS);
    }

    if (req.query && typeof req.query === 'object') {
      req.query = keysToCamel(
        req.query,
        REQUEST_CASE_TRANSFORM_OPTIONS,
      );
    }

    next();
  }
}
