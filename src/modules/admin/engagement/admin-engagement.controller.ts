import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminTiers } from '../../../common/decorators/admin-tiers.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminTier, UserRole } from '../../users/entities/user.entity';
import { AdminEngagementService } from './admin-engagement.service';
import { AdminMinorUptakeQueryDto } from './dto/admin-minor-uptake-query.dto';
import {
  AdminEngagementMinorUptakeResponse,
  AdminEngagementRetakeDropoffResponse,
  AdminEngagementStatsResponse,
} from './dto/admin-engagement-responses.dto';

@ApiTags('admin-engagement')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@AdminTiers(AdminTier.SUPER_ADMIN, AdminTier.ADMIN, AdminTier.REVIEWER)
@Controller('admin/engagement')
export class AdminEngagementController {
  constructor(private readonly engagementService: AdminEngagementService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Engagement page stat cards (row of 4)' })
  @ApiOkResponse({ type: AdminEngagementStatsResponse })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient admin tier' })
  async getStats() {
    const data = await this.engagementService.getStats();
    return { status: 'success', data };
  }

  @Get('retake-dropoff')
  @ApiOperation({ summary: 'Retake drop-off by attempt number (bar chart)' })
  @ApiOkResponse({ type: AdminEngagementRetakeDropoffResponse })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient admin tier' })
  async getRetakeDropoff(): Promise<AdminEngagementRetakeDropoffResponse> {
    const data = await this.engagementService.getRetakeDropoff();
    return { status: 'success', data };
  }

  @Get('minor-uptake')
  @ApiOperation({ summary: 'Minor assessment uptake by type (bar chart)' })
  @ApiOkResponse({ type: AdminEngagementMinorUptakeResponse })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient admin tier' })
  getMinorUptake(
    @Query() query: AdminMinorUptakeQueryDto,
  ): AdminEngagementMinorUptakeResponse {
    const data = this.engagementService.getMinorUptake(query.track);
    return { status: 'success', data };
  }
}
