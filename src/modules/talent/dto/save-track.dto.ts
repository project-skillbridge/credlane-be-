import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';
import { VerifiedLevel } from '../../assessments/entities/assessment-question.entity';
import { TALENT_CLAIMED_LEVELS, TALENT_ROLE_TRACKS } from '../talent.constants';

export type SaveTrackClaimedLevel = VerifiedLevel;

const SAVE_TRACK_CLAIMED_LEVEL_LIST: VerifiedLevel[] = [...TALENT_CLAIMED_LEVELS];

export type SaveTrackBody = {
  track: string;
  claimed_level: SaveTrackClaimedLevel;
};

export class SaveTrackDto implements SaveTrackBody {
  @ApiProperty({
    example: 'frontend_developer',
    enum: TALENT_ROLE_TRACKS,
    description: 'Single track selected by the talent user',
  })
  @IsNotEmpty({ message: 'Track is required' })
  @IsIn(TALENT_ROLE_TRACKS, { message: 'Invalid track selection' })
  track: string;

  @ApiProperty({
    example: VerifiedLevel.MID,
    enum: SAVE_TRACK_CLAIMED_LEVEL_LIST,
    description:
      'Self-reported skill level for the selected track (verified_level_enum)',
  })
  @IsNotEmpty({ message: 'Claimed level is required' })
  @IsIn(SAVE_TRACK_CLAIMED_LEVEL_LIST, {
    message: 'Invalid claimed level selection',
  })
  claimed_level: SaveTrackClaimedLevel;
}
