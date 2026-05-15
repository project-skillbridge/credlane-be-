import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiCookieAuth,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { setAuthCookies } from '../auth/auth.cookies';
import { UserRole } from '../users/entities/user.entity';
import { UploadService } from '../upload/upload.service';
import { CompleteTalentOnboardingDto } from './dto/complete-talent-onboarding.dto';
import { SetGoalDto } from './dto/set-goal.dto';
import { SetTracksDto } from './dto/set-tracks.dto';
import { SetProfileDto } from './dto/set-profile.dto';
import { SaveGoalDto } from './dto/save-goal.dto';
import { SaveTrackDto } from './dto/save-track.dto';
import { SaveTalentProfileDto } from './dto/save-talent-profile.dto';
import { TalentService } from './talent.service';
import { ErrorMessages, SuccessMessages } from '../../shared';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

@ApiTags('talent')
@ApiCookieAuth()
@Controller('talent')
@Roles(UserRole.TALENT)
export class TalentController {
  constructor(
    private readonly talentService: TalentService,
    private readonly uploadService: UploadService,
  ) {}

  @Get('onboarding')
  @ApiOperation({ summary: 'Get current onboarding state (for pre-filling forms)' })
  @ApiOkResponse({ description: 'Returns user info and current profile' })
  async getOnboardingState(@CurrentUser('sub') userId: string) {
    return this.talentService.getOnboardingState(userId);
  }

  @Patch('onboarding/goal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 1 — save career goal' })
  @ApiForbiddenResponse({ description: 'Onboarding already completed' })
  async saveGoal(
    @CurrentUser('sub') userId: string,
    @Body() dto: SetGoalDto,
  ) {
    return this.talentService.saveGoal(userId, dto);
  }

  @Patch('onboarding/tracks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 2 — save role tracks' })
  @ApiForbiddenResponse({ description: 'Onboarding already completed' })
  async saveTracks(
    @CurrentUser('sub') userId: string,
    @Body() dto: SetTracksDto,
  ) {
    return this.talentService.saveTracks(userId, dto);
  }

  @Post('onboarding/avatar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload avatar to S3; returns avatarUrl for use in profile step' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(ErrorMessages.ONBOARDING.INVALID_FILE_TYPE),
            false,
          );
        }
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException(ErrorMessages.ONBOARDING.NO_FILE);
    }
    const avatarUrl = await this.uploadService.uploadAvatar(file);
    await this.talentService.updateUserAvatar(userId, avatarUrl);
    return {
      message: SuccessMessages.ONBOARDING.AVATAR_UPLOADED,
      avatarUrl,
    };
  }

  @Patch('onboarding/profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 3 — save profile details and complete onboarding' })
  @ApiForbiddenResponse({ description: 'Onboarding already completed' })
  async saveProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: SetProfileDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.talentService.saveProfile(userId, dto);
    setAuthCookies(response, result.tokens);
    return {
      message: result.message,
      user: result.user,
      profile: result.profile,
    };
  }

  /** BE-ONB-TAL-001 — save goal (single select, 422 on missing/invalid). */
  @Post('onboarding/goal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 1 — save career goal (BE-ONB-TAL-001)' })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true, errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
  async saveGoalStep(
    @CurrentUser('sub') userId: string,
    @Body() dto: SaveGoalDto,
  ) {
    return this.talentService.saveGoalStep(userId, dto);
  }

  /** BE-ONB-TAL-002 — save single track (422 on missing/invalid). */
  @Post('onboarding/track')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 2 — save track (BE-ONB-TAL-002)' })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true, errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
  async saveTrackStep(
    @CurrentUser('sub') userId: string,
    @Body() dto: SaveTrackDto,
  ) {
    return this.talentService.saveTrackStep(userId, dto);
  }

  /** BE-ONB-TAL-003 — save profile; photo required, optional fields optional. */
  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Step 3 — save talent profile with photo upload (BE-ONB-TAL-003)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new UnprocessableEntityException(ErrorMessages.ONBOARDING.INVALID_PHOTO_TYPE),
            false,
          );
        }
      },
    }),
  )
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true, errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
  async saveTalentProfile(
    @CurrentUser('sub') userId: string,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body() dto: SaveTalentProfileDto,
  ) {
    if (!photo) {
      throw new UnprocessableEntityException(ErrorMessages.ONBOARDING.PHOTO_REQUIRED);
    }
    if (photo.size > MAX_FILE_BYTES) {
      throw new UnprocessableEntityException(ErrorMessages.ONBOARDING.PHOTO_TOO_LARGE);
    }
    return this.talentService.saveTalentProfile(userId, photo, dto);
  }

  /** BE-ONB-TAL-004 — trigger personalisation; no body needed. */
  @Post('onboarding/personalise')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 4 — personalise dashboard from saved onboarding data (BE-ONB-TAL-004)' })
  async personalise(@CurrentUser('sub') userId: string) {
    return this.talentService.personalise(userId);
  }

  /** Legacy single-step endpoint — kept for backward compatibility. */
  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete talent onboarding (legacy single-step)' })
  @ApiForbiddenResponse({ description: 'Onboarding already completed' })
  async completeOnboarding(
    @CurrentUser('sub') userId: string,
    @Body() dto: CompleteTalentOnboardingDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.talentService.completeOnboarding(userId, dto);
    setAuthCookies(response, result.tokens);
    return {
      message: result.message,
      user: result.user,
      profile: result.profile,
    };
  }
}