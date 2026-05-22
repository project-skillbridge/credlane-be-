import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { Offer } from './offer.entity';

@Entity('offer_distribution_logs')
@Index('IDX_offer_distribution_logs_employer_sent', [
  'employer_user_id',
  'sent_at',
])
export class OfferDistributionLog {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  employer_user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employer_user_id' })
  employer: User;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  offer_id: string;

  @ManyToOne(() => Offer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offer_id' })
  offer: Offer;

  @ApiProperty()
  @Column({ type: 'timestamp with time zone', default: () => 'now()' })
  sent_at: Date;
}
