import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOfferDto {
  @ApiProperty({ format: 'uuid', description: 'Candidate user ID' })
  @IsNotEmpty()
  @IsUUID()
  candidate_user_id: string;

  @ApiProperty({ description: 'Job role title' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  role_title: string;

  @ApiProperty({ description: 'Role description', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  role_description?: string;

  @ApiProperty({
    required: false,
    description: 'Legacy offer message / description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiProperty({ description: 'Compensation or salary range' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  compensation: string;

  @ApiProperty({
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship'],
  })
  @IsNotEmpty()
  @IsIn(['Full-time', 'Part-time', 'Contract', 'Internship'])
  employment_type: string;

  @ApiProperty({ enum: ['Remote', 'Hybrid', 'On-site'] })
  @IsNotEmpty()
  @IsIn(['Remote', 'Hybrid', 'On-site'])
  work_arrangement: string;

  @ApiProperty({ required: false, type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  application_deadline?: string;

  @ApiProperty({
    required: false,
    default: 14,
    description: 'Offer expiry in days (1-90)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  expires_in_days?: number = 14;
}
