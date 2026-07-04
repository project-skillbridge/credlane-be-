import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminTiers } from '../../../common/decorators/admin-tiers.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminTier, UserRole } from '../../users/entities/user.entity';
import { AdminOverviewService } from './admin-overview.service';
import { AiGenerationConsumptionQueryDto } from './dto/ai-generation-consumption-query.dto';
import { NewUsersQueryDto } from './dto/new-users-query.dto';
import { ScoreDistributionQueryDto } from './dto/score-distribution-query.dto';

@ApiTags('admin-overview')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@AdminTiers(AdminTier.SUPER_ADMIN, AdminTier.ADMIN, AdminTier.REVIEWER)
@Controller('admin/overview')
export class AdminOverviewController {
  constructor(private readonly overviewService: AdminOverviewService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Overview stat cards (row of 5)' })
  async getStats() {
    const data = await this.overviewService.getStats();
    return { status: 'success', data };
  }

  @Get('score-distribution')
  @ApiOperation({ summary: 'Chart 1 — Stage 3 score distribution histogram' })
  async getScoreDistribution(@Query() query: ScoreDistributionQueryDto) {
    const data = await this.overviewService.getScoreDistribution(query.track);
    return { status: 'success', data };
  }

  @Get('ai-generation-consumption')
  @ApiOperation({
    summary: 'Chart 2 — AI question generation volume over time',
  })
  async getAiGenerationConsumption(
    @Query() query: AiGenerationConsumptionQueryDto,
  ) {
    const data = await this.overviewService.getAiGenerationConsumption(
      query.period ?? 'monthly',
    );
    return { status: 'success', data };
  }

  @Get('new-users')
  @ApiOperation({ summary: 'Most recent talent and employer signups' })
  async getNewUsers(@Query() query: NewUsersQueryDto) {
    const data = await this.overviewService.getNewUsers(query);
    return { status: 'success', data };
  }
}
