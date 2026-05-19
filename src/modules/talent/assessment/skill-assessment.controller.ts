import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import {
  StartSkillAssessmentDto,
  SubmitSkillAssessmentDto,
} from './dto/skill-assessment.dto';
import { SkillAssessmentService } from './skill-assessment.service';

@ApiTags('talent-assessment')
@ApiCookieAuth()
@Controller('talent/assessment/skill')
@Roles(UserRole.TALENT)
export class SkillAssessmentController {
  constructor(
    private readonly skillAssessmentService: SkillAssessmentService,
  ) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start a skill assessment',
    description:
      'Requires completed personal assessment plus onboarding track and claimed level. ' +
      'Generates a personalised AI question set, creates a session, and returns the ordered questions.',
  })
  @ApiCreatedResponse({ description: 'Assessment session created with questions' })
  @ApiNotFoundResponse({ description: 'Talent profile not found' })
  @ApiUnprocessableEntityResponse({
    description:
      'Personal assessment incomplete, or required onboarding fields missing',
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
    @Body() _dto: StartSkillAssessmentDto,
  ) {
    return this.skillAssessmentService.start(userId);
  }


  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit skill assessment answers',
    description:
      'Scores MCQs immediately, sends text answers to the AI rubric layer, writes validated_level to the talent profile, ' +
      'and enforces the 75% pass gate for advanced access. Failed attempts return guidance plus a 14-day retry date.',
  })
  @ApiOkResponse({ description: 'Assessment scored and validated_level written' })
  @ApiNotFoundResponse({ description: 'Profile or attempt not found' })
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
    @Body() dto: SubmitSkillAssessmentDto,
  ) {
    return this.skillAssessmentService.submit(userId, dto);
  }
}
