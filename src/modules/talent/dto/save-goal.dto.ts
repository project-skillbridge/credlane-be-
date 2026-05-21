import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';
import { TALENT_GOALS } from '../talent.constants';

export class SaveGoalDto {
  @ApiProperty({
    example: 'land_first_role',
    enum: TALENT_GOALS,
    description: 'Career goal selected by the talent user',
  })
  @IsNotEmpty({ message: 'Goal is required' })
  @IsIn(TALENT_GOALS, { message: 'Invalid goal selection' })
  goal: string;
}
