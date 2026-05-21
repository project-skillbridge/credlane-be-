import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { VerifiedProfileResponseDto } from './dto/verified-profile.dto';
import { VerifiedProfileService } from './verified-profile.service';

@ApiTags('verified-profile')
@Controller()
export class VerifiedProfileController {
  constructor(
    private readonly verifiedProfileService: VerifiedProfileService,
  ) {}

  @Get('talent/verified-profile')
  @ApiCookieAuth()
  @Roles(UserRole.TALENT)
  @ApiOperation({
    summary: 'Get the authenticated talent verified profile',
    description:
      'Returns the job-ready verified profile for the current talent, including assessment-derived scores when available.',
  })
  @ApiOkResponse({ type: VerifiedProfileResponseDto })
  @ApiForbiddenResponse({ description: 'Not a talent user' })
  @ApiNotFoundResponse({
    description: 'Profile not found or talent is not job-ready',
  })
  getOwnVerifiedProfile(
    @CurrentUser('sub') userId: string,
  ): Promise<VerifiedProfileResponseDto> {
    return this.verifiedProfileService.getForTalentUser(userId);
  }

  @Public()
  @Get('verified-profiles/:token')
  @ApiOperation({
    summary: 'Get a job-ready verified profile by share token',
    description:
      'Public shareable view of a verified talent profile. Requires a valid employer-pool share token.',
  })
  @ApiParam({
    name: 'token',
    description: 'Shareable link token from the employer pool profile',
  })
  @ApiOkResponse({ type: VerifiedProfileResponseDto })
  @ApiNotFoundResponse({
    description: 'Invalid token or profile not job-ready',
  })
  getByShareToken(
    @Param('token') token: string,
  ): Promise<VerifiedProfileResponseDto> {
    return this.verifiedProfileService.getByShareToken(token);
  }
}
