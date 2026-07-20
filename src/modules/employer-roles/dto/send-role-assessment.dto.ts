import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SendRoleAssessmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  assessmentId: string;
}
