import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { SavePersonalAssessmentSectionDto } from './dto/save-personal-assessment-section.dto';
import { SubmitGeneratedPersonalAssessmentDto } from './dto/save-personal-assessment-section.dto';
import { PersonalAssessmentService } from './personal-assessment.service';

@ApiTags('talent-assessment')
@ApiCookieAuth()
@Controller('talent/assessment/personal')
@Roles(UserRole.TALENT)
export class PersonalAssessmentController {
  constructor(
    private readonly personalAssessmentService: PersonalAssessmentService,
  ) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generate a personal assessment session',
    description:
      'Generates and stores a frontend-renderable 15-20 question personal assessment from the database question bank (sections 1–5) and candidate onboarding context.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Missing onboarding fields or assessment already completed',
  })
  startGenerated(@CurrentUser('sub') userId: string) {
    return this.personalAssessmentService.startGenerated(userId);
  }

  @Get('session')
  @ApiOperation({
    summary: 'Resume generated personal assessment session',
    description:
      'Returns the generated personal assessment render payload and any saved answers.',
  })
  getGeneratedSession(@CurrentUser('sub') userId: string) {
    return this.personalAssessmentService.getGeneratedSession(userId);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Save and finalize generated personal assessment answers',
    description:
      'Persists the generated answers and finalizes the assessment when the generated session is ready. Use this as the primary generated-flow endpoint.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Session missing, validation failed, or already completed',
  })
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  )
  submitGenerated(
    @CurrentUser('sub') userId: string,
    @Body() dto: SubmitGeneratedPersonalAssessmentDto,
  ) {
    return this.personalAssessmentService.submitGenerated(userId, dto.answers);
  }

  @Post('section/:section')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Deprecated: Save personal assessment answers for one section (1–5)',
    description:
      'Legacy compatibility route for the old staged flow. Prefer POST /submit for the generated assessment experience. Ignores track, educationLevel, region, and linkedinProfile - those come from onboarding on the talent profile. claimedLevel/claimed_level is collected during personal assessment and saved to the talent profile.',
    deprecated: true,
  })
  @ApiUnprocessableEntityResponse({
    description: 'Legacy section validation failed',
  })
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  )
  saveSection(
    @CurrentUser('sub') userId: string,
    @Param('section', ParseIntPipe) section: number,
    @Body() dto: SavePersonalAssessmentSectionDto,
  ) {
    return this.personalAssessmentService.saveSection(
      userId,
      section,
      dto.answers,
    );
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Finalize submitted personal assessment answers',
    description:
      'Finalizes the generated assessment using the stored answers and session metadata. Use POST /submit for the primary flow.',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Missing onboarding fields, missing generated session, or already completed',
  })
  complete(@CurrentUser('sub') userId: string) {
    return this.personalAssessmentService.complete(userId);
  }

  @Get('progress')
  @ApiOperation({
    summary: 'Personal assessment resume progress',
    description:
      'Returns completed section numbers and the next section to continue.',
  })
  getProgress(@CurrentUser('sub') userId: string) {
    return this.personalAssessmentService.getResumeProgress(userId);
  }

  @Get('context')
  @ApiOperation({
    summary: 'Flat AI Prompt Chain context payload',
    description:
      'Returns a single flat object: onboarding fields (track, educationLevel, region, linkedinProfile, claimedLevel, country) plus all personal assessment answer keys. Use GET .../progress for resume state.',
  })
  getContext(@CurrentUser('sub') userId: string) {
    return this.personalAssessmentService.getAiContext(userId);
  }
}
