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
      'Reads verified_level from profile, blocks if claimed_level or track is ' +
      'missing, generates questions via the AI layer, creates an assessment ' +
      'session, and returns questions to the frontend.',
  })
  @ApiCreatedResponse({ description: 'Assessment session created with questions' })
  @ApiNotFoundResponse({ description: 'Talent profile not found' })
  @ApiUnprocessableEntityResponse({
    description: 'claimed_level or track missing, or no questions available',
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
      'Receives answers, scores MCQs immediately, passes text answers to the ' +
      'AI rubric layer, writes validated_level to the talent profile. ' +
      'If downgraded, returns downgraded=true and a personalised message.',
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
