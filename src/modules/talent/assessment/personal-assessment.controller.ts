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
import { PersonalAssessmentService } from './personal-assessment.service';

@ApiTags('talent-assessment')
@ApiCookieAuth()
@Controller('talent/assessment/personal')
@Roles(UserRole.TALENT)
export class PersonalAssessmentController {
  constructor(
    private readonly personalAssessmentService: PersonalAssessmentService,
  ) {}

  @Post('section/:section')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Save personal assessment answers for one section (1–7)',
    description:
      'Ignores track, educationLevel, region, linkedinProfile, and claimedLevel — those come from onboarding on the talent profile.',
  })
  @ApiUnprocessableEntityResponse({ description: 'Section validation failed' })
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
    summary: 'Mark personal assessment complete',
    description:
      'Requires all sections saved and onboarding fields present (track, educationLevel, region).',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Incomplete sections or missing onboarding fields',
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
