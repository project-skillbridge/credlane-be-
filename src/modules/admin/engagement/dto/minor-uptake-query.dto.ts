import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MinorUptakeQueryDto {
  @ApiProperty({ required: false, description: 'Filter by track slug' })
  @IsOptional()
  @IsString()
  track?: string;
}
