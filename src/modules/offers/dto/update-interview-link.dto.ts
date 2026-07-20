import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateInterviewLinkDto {
  @ApiProperty({ example: 'https://meet.google.com/abc-defg-hij' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  interviewLink: string;
}
