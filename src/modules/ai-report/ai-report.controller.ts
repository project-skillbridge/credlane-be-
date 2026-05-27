import { Controller, Get } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AiReportService } from './ai-report.service';

class TalentGuidanceReportsResponseDto {
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Latest skill-assessment guidance report when generated (e.g. emerging, not passed).',
  })
  skill_guidance_report: Record<string, unknown> | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Latest advanced-assessment guidance report when generated (emerging or job_ready).',
  })
  advanced_guidance_report: Record<string, unknown> | null;
}

@ApiTags('ai-report')
@ApiCookieAuth()
@Controller('talent/ai-report')
@Roles(UserRole.TALENT)
export class AiReportController {
  constructor(private readonly aiReportService: AiReportService) {}

  @Get('guidance-report')
  @ApiOperation({
    summary: 'Get AI guidance reports for the talent',
    description:
      'Returns the latest skill and advanced guidance reports when available. All keys are snake_case.',
  })
  @ApiOkResponse({ type: TalentGuidanceReportsResponseDto })
  getGuidanceReport(
    @CurrentUser('sub') userId: string,
  ): Promise<TalentGuidanceReportsResponseDto> {
    return this.aiReportService.getGuidanceReports(userId);
  }
}
