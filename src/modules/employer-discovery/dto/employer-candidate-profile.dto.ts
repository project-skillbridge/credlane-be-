import { ApiProperty } from '@nestjs/swagger';
import { OfferStatus } from '../../offers/entities/offer.entity';
import { VerifiedProfileResponseDto } from '../../verified-profile/dto/verified-profile.dto';

export class EmployerCandidateProfileResponseDto extends VerifiedProfileResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Candidate user id' })
  user_id: string;

  @ApiProperty({
    description: 'Whether the authenticated employer saved this candidate',
  })
  is_saved: boolean;

  @ApiProperty({
    description: 'Whether the employer has a pending or accepted offer out',
  })
  offer_sent: boolean;

  @ApiProperty({
    enum: [OfferStatus.PENDING, OfferStatus.ACCEPTED],
    nullable: true,
  })
  offer_status: OfferStatus | null;
}
