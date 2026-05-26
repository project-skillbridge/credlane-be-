import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EmployerService } from './employer.service';

@ApiTags('employer')
@ApiCookieAuth()
@Controller('employer')
export class EmployerPublicController {
  constructor(private readonly employerService: EmployerService) {}

  @Get(':employerUserId/public-profile')
  @Roles(UserRole.TALENT)
  @ApiOperation({ summary: 'Get employer public profile (talent-facing)' })
  @ApiNotFoundResponse({ description: 'Employer profile not found' })
  async getPublicProfile(
    @Param('employerUserId', ParseUUIDPipe) employerUserId: string,
  ) {
    return this.employerService.getPublicProfile(employerUserId);
  }
}
