import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
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

  @ApiProperty({ description: 'Offer message / description' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  message: string;

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
