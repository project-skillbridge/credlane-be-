import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VerifyGoogleAuthCodeDto {
  @ApiProperty({
    description: 'The authorization code from Google',
    example: '4/0AX4XfWi...',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({
    description: 'The redirect URI used on the frontend to get the code. Defaults to postmessage.',
    example: 'postmessage',
  })
  @IsString()
  @IsOptional()
  redirectUri?: string;

  @ApiPropertyOptional({
    description: 'Optional role if signing up (e.g. talent, employer)',
    example: 'talent',
  })
  @IsString()
  @IsOptional()
  role?: string;
}