import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { TALENT_GOALS } from '../talent.constants';

export class SetGoalDto {
  @ApiProperty({
    example: 'land_first_role',
    enum: TALENT_GOALS,
    description: 'Career goal for the talent',
  })
  @IsIn(TALENT_GOALS, {
    message: `goal must be one of: ${TALENT_GOALS.join(', ')}`,
  })
  goal: string;
}
