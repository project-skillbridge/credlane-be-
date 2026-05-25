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
  ApiAcceptedResponse,
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
  SubmitLt2Dto,
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
      'Requires completed personal assessment, a completed skill assessment, and a verified level. ' +
      'Enforces the 14-day retake gate, blocks duplicate active sessions, excludes previously served questions, ' +
      'and returns 24 ordered questions: 10 MCQ, 10 short-text, and 4 long-text prompts. ' +
      'The final LT-3 reflection question is generated later through POST /session/:id/lt2-submit.',
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
    description:
      'Personal assessment incomplete, skill assessment not completed, or no validated skill level exists',
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

  @Post('session/:id/lt2-submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit LT-2 answer and receive runtime-generated LT-3',
    description:
      'LT-3 (reflection) is generated at runtime from the candidate\u2019s LT-2 answer. ' +
      'POST this endpoint immediately after the candidate ' +
      'submits LT-2; the response contains the LT-3 question to render next. ' +
      'Idempotent: a second call returns the LT-3 that was generated on the first call ' +
      'without invoking the LLM again. Returns 503 LT3_GENERATION_FAILED if the LLM ' +
      'fails (client should retry).',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Session ID' })
  @ApiOkResponse({ description: 'LT-3 generated and appended to session' })
  @ApiNotFoundResponse({ description: 'Session not found' })
  @ApiForbiddenResponse({ description: 'Not a talent user' })
  @ApiServiceUnavailableResponse({
    description: 'LT3_GENERATION_FAILED when the LLM call fails',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'question_id does not match the LT-2 slot, or session has expired / completed / been voided',
  })
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  )
  submitLt2(
    @CurrentUser('sub') userId: string,
    @Param('id') sessionId: string,
    @Body() dto: SubmitLt2Dto,
  ) {
    return this.advancedAssessmentService.submitLt2(userId, sessionId, dto);
  }

  @Post('advanced/submit')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Submit advanced assessment answers',
    description:
      'Validates the session and enqueues background scoring (MCQ + AI rubric, weighted 30/70, tiering, persistence). ' +
      'Returns immediately with status=processing and session_id. ' +
      'Poll GET /dashboard/home for performance.advanced (score, tier, guidanceReport when ready). ' +
      'Optional: GET /session/:id until completed_at is set. ' +
      'Returns 422 LT2_NOT_SUBMITTED if /lt2-submit was never called. ' +
      'Duplicate submits while a job is in flight are deduped by attempt id.',
  })
  @ApiAcceptedResponse({
    description:
      'Submission accepted for background processing (status=processing). Scores and tier appear on dashboard after the worker completes.',
  })
  @ApiServiceUnavailableResponse({
    description:
      'SUBMIT_QUEUE_UNAVAILABLE when submit queue enqueue fails or is unavailable.',
  })
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
      'Accepts tab_switch or copy_paste events. The frontend decides when the threshold has been reached; ' +
      'once called, this endpoint records the event, force-submits/voids the session, marks an advanced retake gate, ' +
      'sets assessment_locked_until, and returns action=logout.',
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
