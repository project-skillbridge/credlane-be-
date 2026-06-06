import { Controller, Get, HttpStatus } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipApiTransform } from '../../common/interceptors/transform.interceptor';
import { DashboardService } from './dashboard.service';
import { DashboardHomeResponseDto } from './dto/dashboard-home.dto';
import { UserRole } from '../users/entities/user.entity';
import { EmployerDashboardEnvelopeResponseDto } from './dto/employer-dashboard.dto';

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
  @SkipApiTransform()
  @ApiOperation({ summary: 'Get the employer dashboard overview summary' })
  @ApiOkResponse({ type: EmployerDashboardEnvelopeResponseDto })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async getEmployerHome(
    @CurrentUser('sub') userId: string,
  ): Promise<EmployerDashboardEnvelopeResponseDto> {
    return {
      status_code: HttpStatus.OK,
      data: await this.dashboardService.getEmployerHome(userId),
    };
  }
}
