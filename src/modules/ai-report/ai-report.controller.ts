import { Controller, Get } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AiReportService } from './ai-report.service';

class GuidanceReportEnvelopeDto {
  @ApiProperty({ description: 'Assessment score achieved' })
  score: number;

  @ApiProperty({ description: 'Maximum possible score' })
  max_score: number;

  @ApiProperty({ description: 'Score as percentage (0-100)' })
  percentage: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'ISO date string of when the attempt was completed',
  })
  attempt_date: string | null;

  @ApiProperty({ description: 'Report type: emerging or job_ready' })
  report_type: string;

  @ApiProperty() ai_summary: string;
  @ApiProperty() summary: string;
  @ApiPropertyOptional() retake_advice: string;
  @ApiProperty() growth_insight: string;
  @ApiProperty({ type: [Object] }) strength_ratings: unknown[];
  @ApiProperty() resource_page_url: string;
  @ApiProperty({ type: [Object] }) weak_area_ratings: unknown[];
  @ApiProperty({ type: [Object] }) recommended_resources: unknown[];
}

class TalentGuidanceReportsResponseDto {
  @ApiPropertyOptional({
    nullable: true,
    type: GuidanceReportEnvelopeDto,
    description: 'Latest skill-assessment guidance report with score data.',
  })
  skill_guidance_report: GuidanceReportEnvelopeDto | null;

  @ApiPropertyOptional({
    nullable: true,
    type: GuidanceReportEnvelopeDto,
    description: 'Latest advanced-assessment guidance report with score data.',
  })
  advanced_guidance_report: GuidanceReportEnvelopeDto | null;
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
