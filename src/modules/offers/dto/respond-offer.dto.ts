import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';

export class RespondOfferDto {
  @ApiProperty({
    enum: ['accept', 'decline'],
    description: 'Action to take on the offer',
  })
  @IsNotEmpty()
  @IsIn(['accept', 'decline'])
  action: 'accept' | 'decline';
}
