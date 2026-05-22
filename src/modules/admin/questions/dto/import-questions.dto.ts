import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUrl } from 'class-validator';

export class ImportQuestionsByUrlDto {
  @ApiPropertyOptional({
    example:
      'https://docs.google.com/document/d/1By-2q0V4ltQ2T0do-Frx8hM2ZiAWeCq1rr4_Ivf4vI0/edit',
  })
  @IsOptional()
  @IsUrl({}, { message: 'drive_url must be a valid URL' })
  drive_url?: string;
}
