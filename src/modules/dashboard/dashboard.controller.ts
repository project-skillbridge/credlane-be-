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
import { EmployerDashboardHomeResponseDto } from './dto/employer-dashboard.dto';

@ApiTags('dashboard')
@ApiCookieAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('home')
  @Roles(UserRole.TALENT)
  @ApiOperation({ summary: 'Get the talent dashboard home summary' })
  @ApiOkResponse({ type: DashboardHomeResponseDto })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async getHome(
    @CurrentUser('sub') userId: string,
  ): Promise<DashboardHomeResponseDto> {
    return this.dashboardService.getHome(userId);
  }

  @Get('employer/home')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Get the employer dashboard overview summary' })
  @ApiOkResponse({ type: EmployerDashboardHomeResponseDto })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async getEmployerHome(
    @CurrentUser('sub') userId: string,
  ): Promise<EmployerDashboardHomeResponseDto> {
    return this.dashboardService.getEmployerHome(userId);
  }
}
