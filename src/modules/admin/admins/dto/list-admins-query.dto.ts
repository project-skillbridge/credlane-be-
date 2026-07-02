import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../users/dto/pagination.dto';

export class ListAdminsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by account status',
    enum: ['active', 'pending_setup', 'deactivated'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Search by name or email' })
  @IsOptional()
  @IsString()
  search?: string;
}
