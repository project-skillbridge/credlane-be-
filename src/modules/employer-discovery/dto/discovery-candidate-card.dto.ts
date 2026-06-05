import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OfferStatus } from '../../offers/entities/offer.entity';

export class DiscoveryCandidateCardDto {
  @ApiProperty({ format: 'uuid' })
  user_id: string;

  @ApiProperty({ example: 'Jane Doe' })
  full_name: string;

  @ApiProperty({ nullable: true })
  avatar_url: string | null;

  @ApiProperty({ example: 'Frontend Developer' })
  role: string;

  @ApiProperty({ example: 'frontend_developer', nullable: true })
  role_track: string | null;

  @ApiProperty({ example: 'Mid Level', nullable: true })
  seniority_badge: string | null;

  @ApiProperty({ example: 'job_ready' })
  tier: string;

  @ApiProperty({ example: 85 })
  score: number;

  @ApiProperty({ type: [String], example: ['React', 'TypeScript'] })
  skills: string[];

  @ApiProperty({
    type: [String],
    example: ['Mid Level', 'Job Ready', 'Open to Work', 'Fully Remote'],
  })
  about_tags: string[];

  @ApiProperty({ nullable: true })
  availability: string | null;

  @ApiProperty({ example: 'Immediately Available', nullable: true })
  availability_label: string | null;

  @ApiProperty()
  verified_at: Date;

  @ApiProperty({ type: [String], nullable: true })
  strong_competencies: string[] | null;

  @ApiProperty({ nullable: true })
  share_token: string | null;

  @ApiProperty({ example: 'Nigeria', nullable: true })
  region: string | null;

  @ApiProperty()
  is_saved: boolean;

  @ApiProperty()
  offer_sent: boolean;

  @ApiPropertyOptional({
    enum: [OfferStatus.PENDING, OfferStatus.ACCEPTED],
    nullable: true,
  })
  offer_status: OfferStatus.PENDING | OfferStatus.ACCEPTED | null;
}

export class DiscoveryCandidatesListResponseDto {
  @ApiProperty({ type: [DiscoveryCandidateCardDto] })
  candidates: DiscoveryCandidateCardDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total_pages: number;

  @ApiProperty({ nullable: true })
  empty_state_message: string | null;
}
