import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { TALENT_ROLE_TRACKS } from '../../../talent/talent.constants';
import type { TalentRoleTrack } from '../../../talent/talent.constants';

export class AdminMinorUptakeQueryDto {
  @ApiProperty({ required: false, enum: TALENT_ROLE_TRACKS })
  @IsOptional()
  @IsIn(TALENT_ROLE_TRACKS as readonly string[])
  track?: TalentRoleTrack;
}
