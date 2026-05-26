import { ApiProperty } from '@nestjs/swagger';
import { IsString, Equals } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({
    example: 'DELETE',
    description: 'Typed confirmation required before irreversible deletion',
  })
  @IsString()
  @Equals('DELETE', { message: 'Type DELETE to confirm account deletion' })
  confirmation: string;
}
