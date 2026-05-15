import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';
import { TALENT_ROLE_TRACKS } from '../talent.constants';

export class SaveTrackDto {
  @ApiProperty({
    example: 'frontend_developer',
    enum: TALENT_ROLE_TRACKS,
    description: 'Single track selected by the talent user',
  })
  @IsNotEmpty({ message: 'Track is required' })
  @IsIn(TALENT_ROLE_TRACKS, { message: 'Invalid track selection' })
  track: string;
}