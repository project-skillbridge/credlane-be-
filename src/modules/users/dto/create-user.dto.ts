import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole, USER_ROLE_VALUES } from '../entities/user.entity';
import { normalizeEmail } from '../../../common/transforms/normalize-email';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(({ value }: { value: unknown }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  lastName: string;

  @ApiProperty({ example: 'Nigeria' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  country: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  profilePicUrl?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  signupReason?: string;

  @ApiProperty({
    enum: USER_ROLE_VALUES,
    required: false,
    default: UserRole.TALENT,
  })
  @IsOptional()
  @IsIn(USER_ROLE_VALUES)
  role?: UserRole;
}
