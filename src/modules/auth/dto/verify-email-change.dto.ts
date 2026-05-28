import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

export class VerifyEmailChangeDto {
  @ApiProperty({ example: 'new.email@company.com' })
  @IsEmail({}, { message: 'Please enter a valid email address' })
  @MaxLength(255)
  newEmail: string;

  @ApiProperty({ description: '6-digit OTP sent to the new email address' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'otp must be a 6-digit code' })
  otp: string;
}
