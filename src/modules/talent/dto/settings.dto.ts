import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

import { TalentAvailabilityStatus } from '../entities/talent-profile.entity';
import { TALENT_ROLE_TRACKS } from '../talent.constants';

export class UpdateTalentSettingsProfileDto {
  @ApiPropertyOptional({ example: 'Alex' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Smith' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  lastName?: string;

  @ApiPropertyOptional({ example: 'frontend_developer' })
  @IsOptional()
  @IsString()
  @IsIn(TALENT_ROLE_TRACKS, {
    message: `roleTrack must be one of: ${TALENT_ROLE_TRACKS.join(', ')}`,
  })
  roleTrack?: string;

  @ApiPropertyOptional({ example: 'https://www.linkedin.com/in/alexsmith' })
  @IsOptional()
  @IsUrl({}, { message: 'linkedinUrl must be a valid URL' })
  @MaxLength(255)
  linkedinUrl?: string;

  @ApiPropertyOptional({ example: 'https://alexsmith.dev' })
  @IsOptional()
  @IsUrl({}, { message: 'personalWebsite must be a valid URL' })
  @MaxLength(500)
  personalWebsite?: string;
}

export class UpdateTalentAvailabilityDto {
  @ApiProperty({
    enum: Object.values(TalentAvailabilityStatus),

    example: TalentAvailabilityStatus.ACTIVELY_LOOKING,
  })
  @IsIn(Object.values(TalentAvailabilityStatus))
  availabilityStatus: TalentAvailabilityStatus;
}

class NotificationPreferenceGroupDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  newOffers?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  assessmentReminders?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  retakeWindowOpen?: boolean;
}

export class UpdateCommunicationPreferencesDto {
  @ApiPropertyOptional({ type: NotificationPreferenceGroupDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferenceGroupDto)
  email?: NotificationPreferenceGroupDto;

  @ApiPropertyOptional({ type: NotificationPreferenceGroupDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferenceGroupDto)
  inApp?: NotificationPreferenceGroupDto;
}
