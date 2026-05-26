import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsString } from 'class-validator';

export class DeactivateAccountDto {
  @ApiProperty({
    example: 'DEACTIVATE',
    description: 'Typed confirmation required before account deactivation',
  })
  @IsString()
  @Equals('DEACTIVATE', {
    message: 'Type DEACTIVATE to confirm account deactivation',
  })
  confirmation: string;
}
