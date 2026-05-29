import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BasicSuccessResponseDto {
  @ApiProperty({ example: 'success' })
  status: 'success';

  @ApiProperty({ example: 'Operation completed' })
  message: string;
}

export class EmailChangeRequestedResponseDto {
  @ApiProperty({ example: 'success' })
  status: 'success';

  @ApiProperty({ example: 'Verification OTP sent to new email' })
  message: string;
}

export class EmailChangeVerifiedResponseDto {
  @ApiProperty({ example: 'success' })
  status: 'success';

  @ApiProperty({ example: 'Work email changed. Please log in again.' })
  message: string;
}

export class AccountDataExportUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'alex@example.com' })
  email: string;

  @ApiProperty({ example: 'Alex' })
  first_name: string;

  @ApiProperty({ example: 'Smith' })
  last_name: string;

  @ApiProperty({ example: 'Nigeria' })
  country: string;

  @ApiProperty({ example: 'talent' })
  role: string;

  @ApiPropertyOptional({ nullable: true })
  avatar_url: string | null;

  @ApiProperty({ example: true })
  is_verified: boolean;

  @ApiProperty({ example: true })
  onboarding_complete: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  created_at: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updated_at: Date;
}

export class AccountDataExportPayloadDto {
  @ApiProperty({ type: String, format: 'date-time' })
  generated_at: string;

  @ApiProperty({ type: AccountDataExportUserDto })
  user: AccountDataExportUserDto;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Talent profile snapshot when the user is a talent.',
  })
  talent_profile: Record<string, unknown> | null;
}

export class AccountDataExportResponseDto {
  @ApiProperty({ example: 'success' })
  status: 'success';

  @ApiProperty({ example: 'Data export emailed to user@example.com' })
  message: string;

  @ApiProperty({
    example: 'data:application/json;base64,...',
    description:
      'Base64 data-URI of the JSON export. Pass as href to an <a download> element for an immediate browser download. Also delivered as an email attachment.',
  })
  download_url: string;
}
