import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../users/dto/pagination.dto';

export class ListEmployersQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by verification status',
    type: Boolean,
  })
  @IsOptional()
  @IsBooleanString()
  is_verified?: string;

  @ApiPropertyOptional({ description: 'Filter by region' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ description: 'Filter by industry' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: 'Search by company name' })
  @IsOptional()
  @IsString()
  search?: string;
}
