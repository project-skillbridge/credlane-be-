import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class VerifyEmailChangeDto {
  @ApiProperty({ example: 'new.email@company.com' })
  @IsEmail({}, { message: 'Please enter a valid email address' })
  @MaxLength(255)
  new_email: string;

  @ApiProperty({ description: '6-digit OTP sent to the new email address' })
  @IsString()
  @Length(6, 6)
  otp: string;
}
