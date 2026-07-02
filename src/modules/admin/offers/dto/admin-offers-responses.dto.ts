import { ApiProperty } from '@nestjs/swagger';
import { OfferStatus } from '../../../offers/entities/offer.entity';

export class TrendIndicator {
  @ApiProperty({ enum: ['up', 'down', null], nullable: true, example: 'up' })
  direction: 'up' | 'down' | null;

  @ApiProperty({ type: Number, nullable: true, example: 15 })
  change_percent: number | null;
}

export class StatCard {
  @ApiProperty({ example: 120 })
  value: number;

  @ApiProperty({ type: TrendIndicator })
  trend: TrendIndicator;
}

export class OffersPageStats {
  @ApiProperty({ type: StatCard })
  total_offers_sent: StatCard;

  @ApiProperty({ type: StatCard })
  offer_to_acceptance_rate: StatCard;

  @ApiProperty({ type: StatCard })
  offer_to_hire_rate: StatCard;

  @ApiProperty({ type: StatCard })
  avg_time_offer_to_hire_days: StatCard;
}

export class FunnelStage {
  @ApiProperty({ example: 'PENDING' })
  stage: string;

  @ApiProperty({ example: 45 })
  count: number;

  @ApiProperty({ type: Number, nullable: true, example: 25 })
  drop_off_percent: number | null;
}

export class OfferFunnelResult {
  @ApiProperty({ type: [FunnelStage] })
  stages: FunnelStage[];

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: false })
  empty: boolean;
}

export class AdminOfferRow {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  candidate_name: string;

  @ApiProperty({ example: 'Acme Corp' })
  employer_name: string;

  @ApiProperty({ example: 'Software Engineer' })
  role_title: string;

  @ApiProperty({ enum: OfferStatus, example: OfferStatus.ACCEPTED })
  status: OfferStatus;

  @ApiProperty({ example: '2026-06-01T10:00:00Z' })
  date_sent: Date;

  @ApiProperty({ type: Date, nullable: true, example: '2026-06-05T10:00:00Z' })
  date_resolved: Date | null;
}

export class AdminOfferListResult {
  @ApiProperty({ type: [AdminOfferRow] })
  offers: AdminOfferRow[];

  @ApiProperty({ example: 150 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 8 })
  total_pages: number;
}

export class AdminOffersStatsResponse {
  @ApiProperty({ example: 'success' })
  status: string;
  @ApiProperty({ type: OffersPageStats })
  data: OffersPageStats;
}

export class AdminOfferFunnelResponse {
  @ApiProperty({ example: 'success' })
  status: string;
  @ApiProperty({ type: OfferFunnelResult })
  data: OfferFunnelResult;
}

export class AdminOfferListResponse {
  @ApiProperty({ example: 'success' })
  status: string;
  @ApiProperty({ type: AdminOfferListResult })
  data: AdminOfferListResult;
}
