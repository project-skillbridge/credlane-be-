import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { clearAuthCookies, setAuthCookies } from '../auth/auth.cookies';
import { AuthService } from '../auth/auth.service';
import {
  ApiChangePasswordSettings,
  ApiDeleteAccountSettings,
  ApiRequestEmailChangeSettings,
  ApiVerifyEmailChangeSettings,
} from '../auth/docs/account-settings.swagger';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { DeleteAccountDto } from '../auth/dto/delete-account.dto';
import { RequestEmailChangeDto } from '../auth/dto/request-email-change.dto';
import { VerifyEmailChangeDto } from '../auth/dto/verify-email-change.dto';
import {
  ListNotificationsQueryDto,
  UnreadCountResponseDto,
} from '../notifications/dto/notification.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../users/entities/user.entity';
import { CompleteEmployerOnboardingDto } from './dto/complete-employer-onboarding.dto';
import { EmployerNotificationsListResponseDto } from './dto/employer-notification.dto';
import { EmployerProfileResponseDto } from './dto/employer-profile-response.dto';
import { EmployerVerificationStatusResponseDto } from './dto/employer-verification-status.dto';
import { SaveEmployerProfileDto } from './dto/save-employer-profile.dto';
import { UpdateEmployerProfileDto } from './dto/update-employer-profile.dto';
import {
  EmployerNotificationItem,
  toEmployerNotificationItem,
} from './employer-notification.mapper';
import { EmployerService } from './employer.service';
import { EmployerVerificationService } from './employer-verification.service';

@ApiTags('employer')
@ApiCookieAuth()
@Controller('employer')
@Roles(UserRole.EMPLOYER)
export class EmployerController {
  constructor(
    private readonly employerService: EmployerService,
    private readonly authService: AuthService,
    private readonly notificationsService: NotificationsService,
    private readonly verificationService: EmployerVerificationService,
  ) {}

  @Get('profile/public/:employer_id')
  @Roles(UserRole.TALENT, UserRole.EMPLOYER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get employer public profile (talent- and employer-facing)',
  })
  @ApiNotFoundResponse({ description: 'Employer profile not found' })
  async getPublicProfile(
    @Param('employer_id', ParseUUIDPipe) employerId: string,
  ) {
    return this.employerService.getPublicProfile(employerId);
  }

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get employer profile for edit state' })
  @ApiOkResponse({ type: EmployerProfileResponseDto })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.employerService.getProfile(userId);
  }

  @Get('verification-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get employer verification status and criteria' })
  @ApiOkResponse({ type: EmployerVerificationStatusResponseDto })
  async getVerificationStatus(
    @CurrentUser('sub') userId: string,
  ): Promise<EmployerVerificationStatusResponseDto> {
    return this.verificationService.getVerificationStatusDetail(userId);
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

  @UseGuards(ThrottlerGuard)
  @Delete('settings/account')
  @HttpCode(HttpStatus.OK)
  @ApiDeleteAccountSettings()
  async deleteAccount(
    @CurrentUser('sub') userId: string,
    @Body() dto: DeleteAccountDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const forwardedFor = request.get('x-forwarded-for');
    const clientIp = forwardedFor?.split(',')[0]?.trim() || request.ip;

    const result = await this.authService.deleteAccount(userId, dto, {
      ip_address: clientIp,
      user_agent: request.get('user-agent') ?? null,
    });
    clearAuthCookies(response);
    return result;
  }

  @Get('notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List in-app notifications for the employer' })
  @ApiOkResponse({ type: EmployerNotificationsListResponseDto })
  async listNotifications(
    @CurrentUser('sub') userId: string,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<{ items: EmployerNotificationItem[] }> {
    const rows = await this.notificationsService.listForUser(
      userId,
      query.limit ?? 20,
    );
    const items: EmployerNotificationItem[] = rows.map(
      toEmployerNotificationItem,
    );
    return { items };
  }

  @Get('notifications/unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get unread in-app notification count for the employer',
  })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  async getUnreadNotificationCount(
    @CurrentUser('sub') userId: string,
  ): Promise<UnreadCountResponseDto> {
    const unreadCount = await this.notificationsService.countUnread(userId);
    return { unread_count: unreadCount };
  }

  @Patch('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiOkResponse({ description: 'All notifications marked as read' })
  async markAllNotificationsAsRead(
    @CurrentUser('sub') userId: string,
  ): Promise<void> {
    await this.notificationsService.markAllAsRead(userId);
  }

  @Patch('notifications/:notification_id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiNotFoundResponse({ description: 'Notification not found' })
  @ApiOkResponse({ description: 'Notification marked as read' })
  async markNotificationAsRead(
    @CurrentUser('sub') userId: string,
    @Param('notification_id', ParseUUIDPipe) notificationId: string,
  ): Promise<void> {
    await this.notificationsService.markAsRead(userId, notificationId);
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
