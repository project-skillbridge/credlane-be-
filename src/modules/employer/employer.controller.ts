import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UseGuards,
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
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { clearAuthCookies, setAuthCookies } from '../auth/auth.cookies';
import { AuthService } from '../auth/auth.service';
import {
  ApiChangePasswordSettings,
  ApiRequestEmailChangeSettings,
  ApiVerifyEmailChangeSettings,
} from '../auth/docs/account-settings.swagger';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { RequestEmailChangeDto } from '../auth/dto/request-email-change.dto';
import { VerifyEmailChangeDto } from '../auth/dto/verify-email-change.dto';
import { UserRole } from '../users/entities/user.entity';
import { CompleteEmployerOnboardingDto } from './dto/complete-employer-onboarding.dto';
import { SaveEmployerProfileDto } from './dto/save-employer-profile.dto';
import { UpdateEmployerProfileDto } from './dto/update-employer-profile.dto';
import { EmployerService } from './employer.service';

@ApiTags('employer')
@ApiCookieAuth()
@Controller('employer')
@Roles(UserRole.EMPLOYER)
export class EmployerController {
  constructor(
    private readonly employerService: EmployerService,
    private readonly authService: AuthService,
  ) {}

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get employer profile for edit state' })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.employerService.getProfile(userId);
  }

  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Save employer profile and complete onboarding (BE-ONB-EMP-001)',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Validation failed — field-specific error messages',
  })
  @ApiForbiddenResponse({
    description: 'Onboarding already completed or wrong role',
  })
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

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update employer profile fields after onboarding',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Validation failed — field-specific error messages',
  })
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  )
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateEmployerProfileDto,
  ) {
    return this.employerService.updateProfile(userId, dto);
  }

  @UseGuards(ThrottlerGuard)
  @Patch('settings/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiChangePasswordSettings()
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.changePassword(userId, dto);
    clearAuthCookies(response);
    return result;
  }

  @UseGuards(ThrottlerGuard)
  @Post('settings/change-email')
  @HttpCode(HttpStatus.OK)
  @ApiRequestEmailChangeSettings()
  requestEmailChange(
    @CurrentUser('sub') userId: string,
    @Body() dto: RequestEmailChangeDto,
  ) {
    return this.authService.requestEmailChange(userId, dto);
  }

  @UseGuards(ThrottlerGuard)
  @Post('settings/change-email/verify')
  @HttpCode(HttpStatus.OK)
  @ApiVerifyEmailChangeSettings()
  async verifyEmailChange(
    @CurrentUser('sub') userId: string,
    @Body() dto: VerifyEmailChangeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyEmailChange(userId, dto);
    clearAuthCookies(response);
    return result;
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
