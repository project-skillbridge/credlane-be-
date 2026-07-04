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
import { MinorUptakeQueryDto } from './dto/minor-uptake-query.dto';

@ApiTags('admin-engagement')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@AdminTiers(AdminTier.SUPER_ADMIN, AdminTier.ADMIN, AdminTier.REVIEWER)
@Controller('admin/engagement')
export class AdminEngagementController {
  constructor(private readonly engagementService: AdminEngagementService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Engagement stat cards (row of 4)' })
  @ApiOkResponse({ description: 'Engagement stats with trend indicators' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient admin tier' })
  async getStats() {
    const data = await this.engagementService.getStats();
    return { status: 'success', data };
  }

  @Get('retake-dropoff')
  @ApiOperation({ summary: 'Chart 1 — Retake drop-off by attempt number' })
  @ApiOkResponse({ description: 'Bucket counts per attempt number' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient admin tier' })
  async getRetakeDropoff() {
    const data = await this.engagementService.getRetakeDropoff();
    return { status: 'success', data };
  }

  @Get('minor-uptake')
  @ApiOperation({ summary: 'Chart 2 — Minor assessment uptake by type' })
  @ApiOkResponse({ description: 'Uptake buckets per minor assessment type' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient admin tier' })
  getMinorUptake(@Query() query: MinorUptakeQueryDto) {
    const data = this.engagementService.getMinorUptake(query.track);
    return { status: 'success', data };
  }
}
