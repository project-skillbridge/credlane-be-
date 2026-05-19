import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { AdvancedAssessmentService } from './advanced-assessment.service';
import {
  FlagIntegrityEventDto,
  StartAdvancedAssessmentDto,
  SubmitAdvancedAssessmentDto,
} from './dto/advanced-assessment.dto';

@ApiTags('talent-assessment')
@ApiCookieAuth()
@Controller('talent/assessment')
@Roles(UserRole.TALENT)
export class AdvancedAssessmentController {
  constructor(
    private readonly advancedAssessmentService: AdvancedAssessmentService,
  ) {}

  @Post('advanced/start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start an advanced assessment',
    description:
      'Requires a verified skill level. Enforces the 14-day retake gate. Blocks duplicate active sessions, excludes previously served questions, creates a timed server-side session, and returns 25 ordered questions as MCQ, short-text, then long-text blocks.',
  })
  @ApiCreatedResponse({ description: 'Advanced assessment session created' })
  @ApiConflictResponse({
    description: 'An active advanced session already exists',
  })
  @ApiForbiddenResponse({
    description: 'Not a talent user or retake gate in effect',
  })
  @ApiNotFoundResponse({ description: 'Talent profile not found' })
  @ApiServiceUnavailableResponse({
    description: 'BANK_EXHAUSTED when fewer than 25 eligible questions exist',
  })
  @ApiUnprocessableEntityResponse({
    description: 'LEVEL_NOT_VERIFIED when no validated skill level exists',
  })
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  )
  start(
    @CurrentUser('sub') userId: string,
    @Body() _dto: StartAdvancedAssessmentDto,
  ) {
    return this.advancedAssessmentService.start(userId);
  }

  @Get('session/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resume an assessment session',
    description:
      'Returns server-side session state. The timer is calculated from expires_at and does not pause while the candidate is disconnected.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Assessment session state returned' })
  @ApiNotFoundResponse({ description: 'Session not found' })
  @ApiForbiddenResponse({ description: 'Not a talent user' })
  getSession(
    @CurrentUser('sub') userId: string,
    @Param('id') sessionId: string,
  ) {
    return this.advancedAssessmentService.getSession(userId, sessionId);
  }

  @Post('advanced/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit advanced assessment answers',
    description:
      'Scores MCQs immediately (1/0). Passes text answers to the AI rubric layer (short-text: 4 dims, long-text LT-3: 2 dims). Computes percentage out of 198 pts max. ' +
      '≥75% → Job Ready + employer pool profile. 50–74% → Emerging + guidance report + 14-day gate. <50% → Not Ready + guidance report + 14-day gate. ' +
      'Accepts submissions on expired sessions (auto_submitted=true, unanswered questions scored 0).',
  })
  @ApiOkResponse({ description: 'Assessment scored and tier written' })
  @ApiNotFoundResponse({ description: 'Profile or session not found' })
  @ApiForbiddenResponse({ description: 'Not a talent user' })
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  )
  submit(
    @CurrentUser('sub') userId: string,
    @Body() dto: SubmitAdvancedAssessmentDto,
  ) {
    return this.advancedAssessmentService.submit(userId, dto);
  }

  @Post('session/:id/flag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Report an integrity event',
    description:
      'Accepts tab_switch or copy_paste events. Tab switch 1–2: logs + returns warning (action=warn). ' +
      'Tab switch 3: voids session + triggers 14-day retake gate + returns action=logout. ' +
      'Copy-paste: logs + returns toast confirmation.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Session ID' })
  @ApiOkResponse({ description: 'Integrity event recorded' })
  @ApiNotFoundResponse({ description: 'Session not found' })
  @ApiForbiddenResponse({ description: 'Not a talent user' })
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  )
  flagIntegrity(
    @CurrentUser('sub') userId: string,
    @Param('id') sessionId: string,
    @Body() dto: FlagIntegrityEventDto,
  ) {
    return this.advancedAssessmentService.flag(userId, sessionId, dto);
  }
}
