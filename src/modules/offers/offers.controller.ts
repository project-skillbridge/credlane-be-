import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SkipApiTransform } from '../../common/interceptors/transform.interceptor';
import { UserRole } from '../users/entities/user.entity';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { RespondOfferDto } from './dto/respond-offer.dto';
import { ListOffersQueryDto } from './dto/list-offers-query.dto';
import {
  EMPLOYER_OFFERS_SUBTAB_NEXTJS_GUIDE,
  EmployerCandidatesOffersListDataDto,
  OfferStatusChangeEventDto,
} from './dto/employer-candidates-offers.swagger';
import { Offer } from './entities/offer.entity';

@ApiTags('Offers')
@ApiExtraModels(EmployerCandidatesOffersListDataDto, OfferStatusChangeEventDto)
@Controller()
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  // ─── Employer endpoints ───────────────────────────────────────────────────

  @Post('employer/offers')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Create and send an offer to a candidate' })
  async createOffer(
    @CurrentUser('sub') employerUserId: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.offersService.createOffer(employerUserId, dto);
  }

  @Get('employer/offers')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'List all offers sent by this employer' })
  async listEmployerOffers(
    @CurrentUser('sub') employerUserId: string,
    @Query() query: ListOffersQueryDto,
  ) {
    return this.offersService.listEmployerOffers(employerUserId, query);
  }

  @Get('employer/candidates/offers/events')
  @Roles(UserRole.EMPLOYER)
  @ApiBearerAuth('JWT')
  @SkipApiTransform()
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary:
      'SSE — live offer status when a candidate accepts or declines (Next.js: EventSource or fetch stream)',
    description: `${EMPLOYER_OFFERS_SUBTAB_NEXTJS_GUIDE}

---

**This endpoint only:** \`Content-Type: text/event-stream\`. Response is **not** wrapped in \`status_code\` / \`data\`. Each event is one SSE \`data:\` line containing \`OfferStatusChangeEventDto\` JSON.`,
  })
  @ApiOkResponse({
    description:
      'Open stream. Example line: data: {"type":"offer_status_changed","status":"declined",...}',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example:
            'data: {"type":"offer_status_changed","offerId":"…","status":"declined","respondedAt":"2026-05-20T12:00:00.000Z"}\n\n',
        },
      },
    },
  })
  streamEmployerOfferStatusEvents(
    @CurrentUser('sub') employerUserId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let closed = false;
    let backpressure = false;
    const pendingChunks: string[] = [];
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let unsubscribe: (() => void) | undefined;

    const cleanup = (): void => {
      if (closed) {
        return;
      }
      closed = true;
      pendingChunks.length = 0;
      if (heartbeat !== undefined) {
        clearInterval(heartbeat);
        heartbeat = undefined;
      }
      unsubscribe?.();
      unsubscribe = undefined;
      if (!res.writableEnded) {
        res.end();
      }
    };

    const flushPendingChunks = (): void => {
      while (
        !closed &&
        !res.writableEnded &&
        !backpressure &&
        pendingChunks.length > 0
      ) {
        const chunk = pendingChunks.shift()!;
        if (!writeSse(chunk)) {
          break;
        }
      }
    };

    const writeSse = (chunk: string): boolean => {
      if (closed || res.writableEnded) {
        return false;
      }
      if (backpressure) {
        pendingChunks.push(chunk);
        return false;
      }
      try {
        const ok = res.write(chunk);
        if (!ok) {
          backpressure = true;
          res.once('drain', () => {
            backpressure = false;
            flushPendingChunks();
          });
        }
        return ok;
      } catch {
        cleanup();
        return false;
      }
    };

    heartbeat = setInterval(() => {
      writeSse(': heartbeat\n\n');
    }, 25_000);

    unsubscribe = this.offersService.subscribeEmployerOfferStatus(
      employerUserId,
      (event) => {
        writeSse(`data: ${JSON.stringify(event)}\n\n`);
      },
    );

    res.on('error', cleanup);
    req.on('error', cleanup);
    req.on('close', cleanup);
  }

  @Get('employer/candidates/offers')
  @Roles(UserRole.EMPLOYER)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary:
      'Candidates tab — Offers subtab list (name, track, job title, date sent, status)',
    description: EMPLOYER_OFFERS_SUBTAB_NEXTJS_GUIDE,
  })
  @ApiOkResponse({
    description: 'Standard API envelope; list payload in `data`.',
    schema: {
      properties: {
        status_code: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Success' },
        data: {
          $ref: '#/components/schemas/EmployerCandidatesOffersListDataDto',
        },
      },
    },
  })
  async listEmployerCandidatesOffers(
    @CurrentUser('sub') employerUserId: string,
    @Query() query: ListOffersQueryDto,
  ) {
    return this.offersService.listEmployerCandidatesOffers(
      employerUserId,
      query,
    );
  }

  @Get('employer/offers/analytics')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Get offer analytics for this employer' })
  async getAnalytics(@CurrentUser('sub') employerUserId: string) {
    return this.offersService.getAnalytics(employerUserId);
  }

  @Get('employer/offers/:offerId')
  @Roles(UserRole.EMPLOYER)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'View Offer modal — read-only offer detail for employer',
    description: `${EMPLOYER_OFFERS_SUBTAB_NEXTJS_GUIDE}

---

**This endpoint:** Use \`offerId\` from the subtab list. Render \`role_title\`, \`message\`, \`status\`, dates, and \`candidate\` as read-only (no employer update route).`,
  })
  @ApiOkResponse({ type: Offer })
  async getEmployerOffer(
    @CurrentUser('sub') employerUserId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ) {
    return this.offersService.getOfferForEmployer(employerUserId, offerId);
  }

  @Patch('employer/offers/:offerId/hire-complete')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Mark an accepted offer as hire complete' })
  async markHireComplete(
    @CurrentUser('sub') employerUserId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ) {
    return this.offersService.markHireComplete(employerUserId, offerId);
  }

  // ─── Talent endpoints ─────────────────────────────────────────────────────

  @Get('talent/offers')
  @Roles(UserRole.TALENT)
  @ApiOperation({ summary: 'List all offers received by this talent' })
  async listCandidateOffers(
    @CurrentUser('sub') candidateUserId: string,
    @Query() query: ListOffersQueryDto,
  ) {
    return this.offersService.listCandidateOffers(candidateUserId, query);
  }

  @Get('talent/offers/:offerId')
  @Roles(UserRole.TALENT)
  @ApiOperation({ summary: 'Get a specific offer received by this talent' })
  async getCandidateOffer(
    @CurrentUser('sub') candidateUserId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ) {
    return this.offersService.getOfferForCandidate(candidateUserId, offerId);
  }

  @Patch('talent/offers/:offerId/respond')
  @Roles(UserRole.TALENT)
  @ApiOperation({ summary: 'Accept or decline an offer' })
  async respondToOffer(
    @CurrentUser('sub') candidateUserId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: RespondOfferDto,
  ) {
    return this.offersService.respondToOffer(
      candidateUserId,
      offerId,
      dto.action,
    );
  }
}
