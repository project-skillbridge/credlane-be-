import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TalentAvailabilityStatus,
  TalentProfileStatus,
} from '../entities/talent-profile.entity';

export class TalentSettingsUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'alex@example.com' })
  email: string;

  @ApiProperty({ example: 'Alex' })
  first_name: string;

  @ApiProperty({ example: 'Smith' })
  last_name: string;

  @ApiProperty({ example: 'Alex Smith' })
  full_name: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'https://cdn.example.com/avatars/avatar.png',
  })
  avatar_url: string | null;

  @ApiProperty({ example: 'talent' })
  role: string;
}

export class TalentSettingsProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ nullable: true, example: 'frontend_developer' })
  role_track: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Frontend Developer' })
  role_label: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'https://www.linkedin.com/in/alexsmith',
  })
  linkedin_url: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Product-minded frontend developer.',
    readOnly: true,
    description:
      'Read-only in settings; set during onboarding, not via PATCH profile.',
  })
  bio: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'https://alexsmith.dev' })
  personal_website: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'https://cdn.example.com/resumes/resume.pdf',
  })
  resume_url: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'my-cv-2026.pdf' })
  resume_filename: string | null;

  @ApiProperty({
    enum: TalentAvailabilityStatus,
    example: TalentAvailabilityStatus.OPEN_TO_OPPORTUNITIES,
  })
  availability_status: TalentAvailabilityStatus;

  @ApiProperty({ example: true })
  is_published: boolean;

  @ApiProperty({ enum: TalentProfileStatus })
  status: TalentProfileStatus;

  @ApiProperty({ example: true })
  profile_verified: boolean;
}

export class NotificationPreferenceGroupResponseDto {
  @ApiProperty({ example: true })
  new_offers: boolean;

  @ApiProperty({ example: true })
  assessment_reminders: boolean;

  @ApiProperty({ example: true })
  retake_window_open: boolean;
}

export class CommunicationPreferencesResponseDto {
  @ApiProperty({ type: NotificationPreferenceGroupResponseDto })
  email: NotificationPreferenceGroupResponseDto;

  @ApiProperty({ type: NotificationPreferenceGroupResponseDto })
  in_app: NotificationPreferenceGroupResponseDto;
}

export class TalentSettingsAccountSessionDto {
  @ApiProperty({ example: 'Current session' })
  label: string;

  @ApiProperty({ example: true })
  is_current: boolean;
}

export class TalentSettingsAccountDto {
  @ApiProperty({ example: true })
  password_set: boolean;

  @ApiProperty({ type: [TalentSettingsAccountSessionDto] })
  active_sessions: TalentSettingsAccountSessionDto[];
}

export class TalentSettingsResponseDto {
  @ApiProperty({ type: TalentSettingsUserDto })
  user: TalentSettingsUserDto;

  @ApiProperty({ type: TalentSettingsProfileDto })
  profile: TalentSettingsProfileDto;

  @ApiProperty({ type: CommunicationPreferencesResponseDto })
  communication_preferences: CommunicationPreferencesResponseDto;

  @ApiProperty({ type: TalentSettingsAccountDto })
  account: TalentSettingsAccountDto;
}

export class TalentSettingsProfileUpdatedResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Settings profile updated' })
  message: string;

  @ApiProperty({ type: TalentSettingsResponseDto })
  data: TalentSettingsResponseDto;
}

export class TalentResumeUploadResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Resume uploaded' })
  message: string;

  @ApiProperty({ example: 'https://cdn.example.com/resumes/resume.pdf' })
  resume_url: string;

  @ApiProperty({ example: 'my-cv-2026.pdf' })
  resume_filename: string;
}

export class TalentResumeDeleteResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Resume deleted' })
  message: string;
}

export class TalentAvailabilityUpdatedResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Availability updated' })
  message: string;

  @ApiProperty({ enum: TalentAvailabilityStatus })
  availability_status: TalentAvailabilityStatus;

  @ApiProperty({ example: true })
  is_published: boolean;
}

export class CommunicationPreferencesEnvelopeDto {
  @ApiProperty({ type: CommunicationPreferencesResponseDto })
  communication_preferences: CommunicationPreferencesResponseDto;
}

export class CommunicationPreferencesUpdatedResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Communication preferences updated' })
  message: string;

  @ApiProperty({ type: CommunicationPreferencesResponseDto })
  communication_preferences: CommunicationPreferencesResponseDto;
}
