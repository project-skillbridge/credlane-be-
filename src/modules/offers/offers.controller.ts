import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { RespondOfferDto } from './dto/respond-offer.dto';
import { ListOffersQueryDto } from './dto/list-offers-query.dto';

@ApiTags('Offers')
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

  @Get('employer/offers/analytics')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Get offer analytics for this employer' })
  async getAnalytics(@CurrentUser('sub') employerUserId: string) {
    return this.offersService.getAnalytics(employerUserId);
  }

  @Get('employer/offers/:offerId')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Get a specific offer sent by this employer' })
  async getEmployerOffer(
    @CurrentUser('sub') employerUserId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ) {
    return this.offersService.getOfferForEmployer(employerUserId, offerId);
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
