import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Senior Backend Engineer' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'Engineering' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  category: string;

  @ApiPropertyOptional({
    description: 'Job description (paste text or from file)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship'],
  })
  @IsOptional()
  @IsIn(['Full-time', 'Part-time', 'Contract', 'Internship'])
  employmentType?: string;

  @ApiPropertyOptional({ enum: ['Remote', 'Hybrid', 'On-site'] })
  @IsOptional()
  @IsIn(['Remote', 'Hybrid', 'On-site'])
  workArrangement?: string;

  @ApiPropertyOptional({ example: 'Bachelor' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  education?: string;

  @ApiPropertyOptional({ type: [String], example: ['NestJS', 'PostgreSQL'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({ example: 80000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({ example: 120000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99999999)
  salaryMax?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Attach an existing assessment',
  })
  @IsOptional()
  @IsUUID()
  assessmentId?: string;
}
