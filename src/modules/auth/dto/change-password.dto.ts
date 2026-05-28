import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { MatchField } from '../validators/match-field.decorator';

export class ChangePasswordDto {
  @ApiProperty({
    description: "The user's current password",
    minLength: 1,
    maxLength: 128,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({
    description: 'The new password. Must differ from the current one.',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;

  @ApiProperty({
    description: 'Must match newPassword exactly',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @MatchField('newPassword', { message: 'Passwords do not match' })
  confirmNewPassword: string;
}
