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
  EMPLOYER_HIRING_LOCATIONS,
  EMPLOYER_TYPES,
} from '../employer.constants';

export class SaveEmployerProfileDto {
  @ApiProperty({
    example: 'Recruiter',
    enum: EMPLOYER_TYPES,
    description: 'Founder | Recruiter | Agency',
  })
  @IsIn(EMPLOYER_TYPES, { message: 'Invalid employer type selection' })
  employerType: string;

  @ApiProperty({ example: 'Acme Labs' })
  @IsString()
  @MinLength(1, { message: 'companyName is required' })
  @MaxLength(255)
  companyName: string;

  @ApiProperty({
    example: '11-50',
    enum: EMPLOYER_COMPANY_SIZES,
    description: '1-10 | 11-50 | 51-200 | 201-500 | 500+',
  })
  @IsIn(EMPLOYER_COMPANY_SIZES, { message: 'Invalid company size selection' })
  companySize: string;

  @ApiPropertyOptional({ example: 'https://acmelabs.com' })
  @IsOptional()
  @IsUrl({}, { message: 'Please enter a valid website URL' })
  @MaxLength(500)
  companyWebsite?: string;

  @ApiProperty({
    example: ['Engineering', 'Design'],
    type: [String],
    description: 'At least one role required; custom values accepted',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Please select at least one role' })
  @IsString({ each: true, message: 'Each role must be a string' })
  hiringRoles: string[];

  @ApiProperty({
    example: ['Nigeria', 'Remote Worldwide'],
    enum: EMPLOYER_HIRING_LOCATIONS,
    isArray: true,
    description: 'Nigeria | Africa | Remote Worldwide | UK | Europe | North America',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Please select at least one location' })
  @IsIn(EMPLOYER_HIRING_LOCATIONS, {
    each: true,
    message: 'Invalid location selection',
  })
  hiringLocations: string[];
}