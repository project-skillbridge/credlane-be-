import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TALENT_ROLE_TRACKS } from '../talent.constants';

export class CompleteTalentOnboardingDto {
  @ApiProperty({ example: 'frontend_developer' })
  @IsString()
  @IsIn(TALENT_ROLE_TRACKS, {
    message: `roleTrack must be one of: ${TALENT_ROLE_TRACKS.join(', ')}`,
  })
  roleTrack: string;

  @ApiPropertyOptional({
    example: 'Entry-level frontend engineer focused on accessible web apps.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;
}
