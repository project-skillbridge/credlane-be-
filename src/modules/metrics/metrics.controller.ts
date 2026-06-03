import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { register } from 'prom-client';
import { Public } from '../../common/decorators/public.decorator';

@Controller('metrics')
export class MetricsController {
  @Public()
  @Get()
  async metrics(@Res() res: Response) {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}
