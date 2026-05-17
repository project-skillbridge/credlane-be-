import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';
import {
  TALENT_CLAIMED_LEVELS,
  TALENT_ROLE_TRACKS,
  type TalentClaimedLevel,
} from '../talent.constants';

export class SaveTrackDto {
  @ApiProperty({
    example: 'frontend_developer',
    enum: TALENT_ROLE_TRACKS,
    description: 'Single track selected by the talent user',
  })
  @IsNotEmpty({ message: 'Track is required' })
  @IsIn(TALENT_ROLE_TRACKS, { message: 'Invalid track selection' })
  track: string;

  @ApiProperty({
    example: 'intermediate',
    enum: TALENT_CLAIMED_LEVELS,
    description: 'Self-reported skill level for the selected track',
  })
  @IsNotEmpty({ message: 'Claimed level is required' })
  @IsIn(TALENT_CLAIMED_LEVELS, { message: 'Invalid claimed level selection' })
  claimed_level: TalentClaimedLevel;
}