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
import { StartAdvancedAssessmentDto } from './dto/advanced-assessment.dto';

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
      'Requires a verified skill level, blocks duplicate active sessions, excludes previously served questions, creates a timed server-side session, and returns 25 ordered questions as MCQ, short-text, then long-text blocks.',
  })
  @ApiCreatedResponse({ description: 'Advanced assessment session created' })
  @ApiConflictResponse({
    description: 'An active advanced session already exists',
  })
  @ApiNotFoundResponse({ description: 'Talent profile not found' })
  @ApiServiceUnavailableResponse({
    description: 'BANK_EXHAUSTED when fewer than 25 eligible questions exist',
  })
  @ApiUnprocessableEntityResponse({
    description: 'LEVEL_NOT_VERIFIED when no validated skill level exists',
  })
  @ApiForbiddenResponse({ description: 'Not a talent user' })
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
}
