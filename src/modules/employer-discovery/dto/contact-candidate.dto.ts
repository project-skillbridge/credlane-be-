import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ContactCandidateDto {
  @ApiProperty({ description: 'Message to send to the candidate' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  message: string;
}
