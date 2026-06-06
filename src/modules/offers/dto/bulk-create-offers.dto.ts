import { ApiProperty, OmitType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
import { CreateOfferDto } from './create-offer.dto';

export class BulkCreateOffersDto extends OmitType(CreateOfferDto, [
  'candidateIds',
] as const) {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Candidate user IDs to receive this offer',
    maxItems: 50,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsNotEmpty({ each: true })
  @IsUUID(undefined, { each: true })
  candidateUserIds: string[];
}
