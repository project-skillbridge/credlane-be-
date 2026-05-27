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

export class UpdateTalentSettingsProfileDto {
  @ApiPropertyOptional({ example: 'Alex' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  first_name?: string;

  @ApiPropertyOptional({ example: 'Smith' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  last_name?: string;

  @ApiPropertyOptional({ example: 'frontend_developer' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role_track?: string;

  @ApiPropertyOptional({ example: 'https://www.linkedin.com/in/alexsmith' })
  @IsOptional()
  @IsUrl({}, { message: 'linkedin_url must be a valid URL' })
  @MaxLength(255)
  linkedin_url?: string;

  @ApiPropertyOptional({ example: 'Product-minded frontend developer.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiPropertyOptional({ example: 'https://alexsmith.dev' })
  @IsOptional()
  @IsUrl({}, { message: 'personal_website must be a valid URL' })
  @MaxLength(500)
  personal_website?: string;
}

export class UpdateTalentAvailabilityDto {
  @ApiProperty({
    enum: Object.values(TalentAvailabilityStatus),
    example: TalentAvailabilityStatus.ACTIVELY_LOOKING,
  })
  @IsIn(Object.values(TalentAvailabilityStatus))
  availability_status: TalentAvailabilityStatus;
}

class NotificationPreferenceGroupDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  new_offers?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  assessment_reminders?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  retake_window_open?: boolean;
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
  in_app?: NotificationPreferenceGroupDto;
}
