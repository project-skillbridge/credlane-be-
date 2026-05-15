import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { setAuthCookies } from '../auth/auth.cookies';
import { UserRole } from '../users/entities/user.entity';
import { CompleteEmployerOnboardingDto } from './dto/complete-employer-onboarding.dto';
import { SaveEmployerProfileDto } from './dto/save-employer-profile.dto';
import { EmployerService } from './employer.service';

@ApiTags('employer')
@ApiCookieAuth()
@Controller('employer')
@Roles(UserRole.EMPLOYER)
export class EmployerController {
  constructor(private readonly employerService: EmployerService) {}

  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Save employer profile and complete onboarding (BE-ONB-EMP-001)' })
  @ApiUnprocessableEntityResponse({ description: 'Validation failed — field-specific error messages' })
  @ApiForbiddenResponse({ description: 'Onboarding already completed or wrong role' })
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  )
  async saveProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: SaveEmployerProfileDto,
  ) {
    return this.employerService.saveProfile(userId, dto);
  }

  /** Legacy single-step onboarding — kept for backward compatibility. */
  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete employer onboarding (legacy)' })
  @ApiForbiddenResponse({ description: 'Onboarding already completed' })
  async completeOnboarding(
    @CurrentUser('sub') userId: string,
    @Body() dto: CompleteEmployerOnboardingDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.employerService.completeOnboarding(userId, dto);
    setAuthCookies(response, result.tokens);
    return {
      message: result.message,
      user: result.user,
      profile: result.profile,
    };
  }
}