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
  EMPLOYER_COMPANY_SIZES,
  EMPLOYER_DESIRED_ROLES,
  EMPLOYER_HIRING_RANGES,
  EMPLOYER_JOINING_AS,
  EMPLOYER_PREFERRED_EXPERIENCE_LEVELS,
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

  @ApiProperty({ example: 'Acme Labs' })
  @IsString()
  @MinLength(1, { message: 'companyName is required' })
  @MaxLength(255)
  companyName: string;

  @ApiProperty({
    example: '11-50',
    enum: EMPLOYER_COMPANY_SIZES,
  })
  @IsIn(EMPLOYER_COMPANY_SIZES, { message: 'Invalid company size selection' })
  companySize: string;

  @ApiProperty({ example: 'Fintech' })
  @IsString()
  @MinLength(1, { message: 'industry is required' })
  @MaxLength(100)
  industry: string;

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
    example: ['junior', 'mid'],
    enum: EMPLOYER_PREFERRED_EXPERIENCE_LEVELS,
    isArray: true,
    description: 'Preferred experience levels',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one experience level' })
  @IsIn(EMPLOYER_PREFERRED_EXPERIENCE_LEVELS, {
    each: true,
    message: 'Invalid experience level selection',
  })
  preferredExperienceLevels: string[];

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
    description:
      'Approximate number of talents to hire: 1_5 | 6_10 | 11_25 | 26_50 | 51_plus',
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

  @ApiPropertyOptional({
    example: 'https://www.linkedin.com/company/acmelabs',
    description: 'LinkedIn company page URL',
  })
  @IsOptional()
  @IsUrl({}, { message: 'linkedinCompanyPageUrl must be a valid URL' })
  @MaxLength(500)
  linkedinCompanyPageUrl?: string;
}
