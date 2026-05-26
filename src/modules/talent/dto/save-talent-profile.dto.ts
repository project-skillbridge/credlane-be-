import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
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
    message: `education_level must be one of: ${TALENT_EDUCATION_LEVELS.join(', ')}`,
  })
  education_level?: string;

  @ApiPropertyOptional({ example: 'https://www.linkedin.com/in/alexsmith' })
  @IsOptional()
  @IsUrl({}, { message: 'linkedin_url must be a valid URL' })
  @Matches(LINKEDIN_REGEX, {
    message:
      'linkedin_url must be a valid LinkedIn profile URL (linkedin.com/in/...)',
  })
  @MaxLength(255)
  linkedin_url?: string;
}
