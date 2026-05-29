import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ErrorMessages } from '../../shared';
import { UserRole } from '../users/entities/user.entity';
import {
  ApiDeleteTalentSettingsResume,
  ApiGetCommunicationPreferences,
  ApiGetTalentSettings,
  ApiUnsubscribeEmailNotifications,
  ApiUpdateCommunicationPreferences,
  ApiUpdateTalentAvailability,
  ApiUpdateTalentSettingsProfile,
  ApiUploadTalentSettingsResume,
} from './docs/talent-settings.swagger';
import {
  UpdateCommunicationPreferencesDto,
  UpdateTalentAvailabilityDto,
  UpdateTalentSettingsProfileDto,
} from './dto/settings.dto';
import { TalentService } from './talent.service';

const ALLOWED_RESUME_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10 MB

@ApiCookieAuth()
@ApiTags('Talent Settings')
@Controller('talent/settings')
@Roles(UserRole.TALENT)
export class TalentSettingsController {
  constructor(private readonly talentService: TalentService) {}

  @Get()
  @ApiGetTalentSettings()
  async getSettings(@CurrentUser('sub') userId: string) {
    return this.talentService.getSettings(userId);
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiUpdateTalentSettingsProfile()
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  )
  async updateSettingsProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateTalentSettingsProfileDto,
  ) {
    return this.talentService.updateSettingsProfile(userId, dto);
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @ApiUploadTalentSettingsResume()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_RESUME_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_RESUME_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Invalid resume file type'), false);
        }
      },
    }),
  )
  async uploadSettingsResume(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException(ErrorMessages.ONBOARDING.NO_FILE);
    }
    return this.talentService.updateResume(userId, file);
  }

  @Delete('resume')
  @HttpCode(HttpStatus.OK)
  @ApiDeleteTalentSettingsResume()
  async deleteSettingsResume(@CurrentUser('sub') userId: string) {
    return this.talentService.deleteResume(userId);
  }

  @Patch('availability')
  @HttpCode(HttpStatus.OK)
  @ApiUpdateTalentAvailability()
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  )
  async updateSettingsAvailability(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateTalentAvailabilityDto,
  ) {
    return this.talentService.updateAvailability(userId, dto);
  }

  @Get('communication-preferences')
  @ApiGetCommunicationPreferences()
  async getCommunicationPreferences(@CurrentUser('sub') userId: string) {
    return {
      communication_preferences:
        await this.talentService.getCommunicationPreferences(userId),
    };
  }

  @Patch('communication-preferences')
  @HttpCode(HttpStatus.OK)
  @ApiUpdateCommunicationPreferences()
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  )
  async updateCommunicationPreferences(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateCommunicationPreferencesDto,
  ) {
    return this.talentService.updateCommunicationPreferences(userId, dto);
  }

  @Patch('communication-preferences/email/unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiUnsubscribeEmailNotifications()
  async unsubscribeEmailNotifications(@CurrentUser('sub') userId: string) {
    return this.talentService.unsubscribeEmailNotifications(userId);
  }
}
