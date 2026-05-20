import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';
import { TALENT_EDUCATION_LEVELS } from '../talent.constants';

const LINKEDIN_REGEX =
  /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%-]+\/?(\?.*)?$/i;

export class SetProfileDto {
  @ApiProperty({ example: 'Nigeria', description: 'Region or country' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  region: string;

  @ApiProperty({
    example: 'bachelor',
    enum: TALENT_EDUCATION_LEVELS,
    description: 'Highest level of education',
  })
  @IsIn(TALENT_EDUCATION_LEVELS, {
    message: `educationLevel must be one of: ${TALENT_EDUCATION_LEVELS.join(', ')}`,
  })
  educationLevel: string;

  @ApiPropertyOptional({
    example: 'https://www.linkedin.com/in/alexsmith',
    description: 'LinkedIn profile URL',
  })
  @IsOptional()
  @IsUrl({}, { message: 'linkedinUrl must be a valid URL' })
  @Matches(LINKEDIN_REGEX, {
    message: 'linkedinUrl must be a valid LinkedIn profile URL (linkedin.com/in/...)',
  })
  linkedinUrl?: string;

  @ApiPropertyOptional({
    example: 'https://bucket.s3.region.amazonaws.com/avatars/user.jpg',
    description: 'Avatar URL returned from the avatar upload endpoint',
  })
  @IsOptional()
  @IsUrl({}, { message: 'avatarUrl must be a valid URL' })
  avatarUrl?: string;
}
