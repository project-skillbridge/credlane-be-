import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ChangeAdminEmailDto {
  @ApiProperty({ example: 'updated.admin@credlane.com' })
  @IsEmail()
  email: string;
}
