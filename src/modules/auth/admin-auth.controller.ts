import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { type Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { setAuthCookies } from './auth.cookies';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

const ADMIN_LOGIN_THROTTLE = { default: { limit: 5, ttl: 900_000 } };

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(ADMIN_LOGIN_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in to the Super Admin Dashboard' })
  @ApiNotFoundResponse({ description: 'No account found with this email.' })
  @ApiUnauthorizedResponse({ description: 'Incorrect email or password.' })
  @ApiForbiddenResponse({ description: 'This account has been deactivated.' })
  @ApiTooManyRequestsResponse({
    description: 'Too many login attempts — limit is 5 per 15 minutes per IP',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.adminLogin(dto);
    setAuthCookies(response, result.tokens);
    return this.authService.toResponse(result);
  }
}
