import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  EMPLOYER_DESIRED_ROLES,
  EMPLOYER_HIRING_RANGES,
  EMPLOYER_JOINING_AS,
} from '../employer.constants';

export class CompleteEmployerOnboardingDto {
  @ApiProperty({
    example: 'recruiter',
    enum: EMPLOYER_JOINING_AS,
    description: 'How the employer identifies — recruiter, founder, or agency',
  })
  @IsIn(EMPLOYER_JOINING_AS, {
    message: `joiningAs must be one of: ${EMPLOYER_JOINING_AS.join(', ')}`,
  })
  joiningAs: string;

  @ApiProperty({
    example: ['frontend_developer', 'backend_developer'],
    enum: EMPLOYER_DESIRED_ROLES,
    isArray: true,
    description: 'Role tracks the employer wants to hire for',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one role' })
  @IsIn(EMPLOYER_DESIRED_ROLES, {
    each: true,
    message: `Each role must be one of: ${EMPLOYER_DESIRED_ROLES.join(', ')}`,
  })
  desiredRoles: string[];

  @ApiProperty({
    example: 'Nigeria',
    description: 'Region the employer is hiring from or targeting',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  region: string;

  @ApiProperty({
    example: '6_10',
    enum: EMPLOYER_HIRING_RANGES,
    description: 'Approximate number of talents to hire: 1_5 | 6_10 | 11_25 | 26_50 | 51_plus',
  })
  @IsIn(EMPLOYER_HIRING_RANGES, {
    message: `hiringCountRange must be one of: ${EMPLOYER_HIRING_RANGES.join(', ')}`,
  })
  hiringCountRange: string;

  @ApiPropertyOptional({
    example: 'https://acmelabs.com',
    description: 'Company website URL',
  })
  @IsOptional()
  @IsUrl({}, { message: 'companyWebsite must be a valid URL' })
  @MaxLength(500)
  companyWebsite?: string;
}