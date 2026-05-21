import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn } from 'class-validator';
import { TALENT_ROLE_TRACKS, TalentRoleTrack } from '../talent.constants';

export class SetTracksDto {
  @ApiProperty({
    example: ['frontend_developer', 'backend_developer'],
    enum: TALENT_ROLE_TRACKS,
    isArray: true,
    description: 'One or more role tracks the talent is interested in',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one role track' })
  @IsIn(TALENT_ROLE_TRACKS, {
    each: true,
    message: `Each track must be one of: ${TALENT_ROLE_TRACKS.join(', ')}`,
  })
  roleTracks: TalentRoleTrack[];
}
