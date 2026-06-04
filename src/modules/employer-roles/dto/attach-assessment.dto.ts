import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AttachAssessmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  assessmentId: string;
}
