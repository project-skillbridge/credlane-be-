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
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOfferDto {
  @ApiProperty({ format: 'uuid', description: 'Candidate user ID' })
  @IsNotEmpty()
  @IsUUID()
  candidateUserId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Role to attach this offer to',
  })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({
    description: 'Job role title. Defaults from role when roleId is supplied.',
  })
  @ValidateIf(
    (dto: CreateOfferDto) => !dto.roleId || dto.roleTitle !== undefined,
  )
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  roleTitle?: string;

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

  @ApiPropertyOptional({
    description:
      'Compensation or salary range. Defaults from role salary when roleId is supplied.',
  })
  @ValidateIf(
    (dto: CreateOfferDto) => !dto.roleId || dto.compensation !== undefined,
  )
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  compensation?: string;

  @ApiPropertyOptional({
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship'],
    description: 'Defaults from role when roleId is supplied.',
  })
  @ValidateIf(
    (dto: CreateOfferDto) => !dto.roleId || dto.employmentType !== undefined,
  )
  @IsNotEmpty()
  @IsIn(['Full-time', 'Part-time', 'Contract', 'Internship'])
  employmentType?: string;

  @ApiPropertyOptional({
    enum: ['Remote', 'Hybrid', 'On-site'],
    description: 'Defaults from role when roleId is supplied.',
  })
  @ValidateIf(
    (dto: CreateOfferDto) => !dto.roleId || dto.workArrangement !== undefined,
  )
  @IsNotEmpty()
  @IsIn(['Remote', 'Hybrid', 'On-site'])
  workArrangement?: string;

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
