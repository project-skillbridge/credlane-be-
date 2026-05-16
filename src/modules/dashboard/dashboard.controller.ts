import { Controller, Get } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardHomeResponseDto } from './dto/dashboard-home.dto';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('dashboard')
@ApiCookieAuth()
@Controller('dashboard')
@Roles(UserRole.TALENT)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('home')
  @ApiOperation({ summary: 'Get the talent dashboard home summary' })
  @ApiOkResponse({ type: DashboardHomeResponseDto })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async getHome(
    @CurrentUser('sub') userId: string,
  ): Promise<DashboardHomeResponseDto> {
    return this.dashboardService.getHome(userId);
  }
}
