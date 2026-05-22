import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveCandidateDto {
  @ApiProperty({
    required: false,
    description: 'Optional notes about the candidate',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
