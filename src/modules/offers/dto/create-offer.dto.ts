import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  candidateUserId: string;

  @ApiProperty({ description: 'Job role title' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  roleTitle: string;

  @ApiPropertyOptional({ description: 'Role description', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  roleDescription?: string;

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
  employmentType: string;

  @ApiProperty({ enum: ['Remote', 'Hybrid', 'On-site'] })
  @IsNotEmpty()
  @IsIn(['Remote', 'Hybrid', 'On-site'])
  workArrangement: string;

  @ApiProperty({ required: false, type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  applicationDeadline?: string;

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
  expiresInDays?: number = 14;
}
