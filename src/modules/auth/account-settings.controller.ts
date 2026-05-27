import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { type Request, type Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { clearAuthCookies } from './auth.cookies';
import { AuthService } from './auth.service';
import {
  ApiChangePasswordSettings,
  ApiDeleteAccountSettings,
  ApiRequestAccountDataExport,
  ApiRequestEmailChangeSettings,
  ApiVerifyEmailChangeSettings,
} from './docs/account-settings.swagger';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { RequestEmailChangeDto } from './dto/request-email-change.dto';
import { VerifyEmailChangeDto } from './dto/verify-email-change.dto';

@ApiCookieAuth()
@ApiTags('Account Settings')
@Controller('auth')
export class AccountSettingsController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(ThrottlerGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiChangePasswordSettings()
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.changePassword(user.sub, dto);
    clearAuthCookies(response);
    return result;
  }

  @UseGuards(ThrottlerGuard)
  @Post('change-email/request')
  @HttpCode(HttpStatus.OK)
  @ApiRequestEmailChangeSettings()
  requestEmailChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestEmailChangeDto,
  ) {
    return this.authService.requestEmailChange(user.sub, dto);
  }

  @UseGuards(ThrottlerGuard)
  @Post('change-email/verify')
  @HttpCode(HttpStatus.OK)
  @ApiVerifyEmailChangeSettings()
  async verifyEmailChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyEmailChangeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyEmailChange(user.sub, dto);
    clearAuthCookies(response);
    return result;
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @ApiDeleteAccountSettings()
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.deleteAccount(user.sub, dto, {
      ip_address: request.ip,
      user_agent: request.get('user-agent') ?? null,
    });
    clearAuthCookies(response);
    return result;
  }

  @Post('account/data-export')
  @HttpCode(HttpStatus.OK)
  @ApiRequestAccountDataExport()
  requestDataExport(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.requestDataExport(user.sub);
  }
}
