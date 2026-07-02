import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class InviteAdminDto {
  @ApiProperty({ example: 'new.admin@credlane.com' })
  @IsEmail()
  email: string;
}
