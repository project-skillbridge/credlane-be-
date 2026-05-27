import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class RequestEmailChangeDto {
  @ApiProperty({ example: 'new.email@company.com' })
  @IsEmail({}, { message: 'Please enter a valid email address' })
  @MaxLength(255)
  newEmail: string;
}
