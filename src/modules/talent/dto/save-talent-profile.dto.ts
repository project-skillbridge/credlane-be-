import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';
import { TALENT_EDUCATION_LEVELS } from '../talent.constants';

const LINKEDIN_REGEX =
  /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%-]+\/?(\?.*)?$/i;

export class SaveTalentProfileDto {
  @ApiPropertyOptional({ example: 'Nigeria' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  region?: string;

  @ApiPropertyOptional({ example: 'bachelor', enum: TALENT_EDUCATION_LEVELS })
  @IsOptional()
  @IsIn(TALENT_EDUCATION_LEVELS, {
    message: `educationLevel must be one of: ${TALENT_EDUCATION_LEVELS.join(', ')}`,
  })
  educationLevel?: string;

  @ApiPropertyOptional({ example: 'https://www.linkedin.com/in/alexsmith' })
  @IsOptional()
  @IsUrl({}, { message: 'linkedinProfile must be a valid URL' })
  @Matches(LINKEDIN_REGEX, {
    message: 'linkedinProfile must be a valid LinkedIn profile URL (linkedin.com/in/...)',
  })
  @MaxLength(255)
  linkedinProfile?: string;
}