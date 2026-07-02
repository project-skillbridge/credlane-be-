import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Transaction } from './transaction.entity';

export enum TalentSubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  FREE = 'free',
}

export const TALENT_SUBSCRIPTION_STATUS_VALUES = [
  TalentSubscriptionStatus.ACTIVE,
  TalentSubscriptionStatus.CANCELLED,
  TalentSubscriptionStatus.FREE,
] as const;

@Entity('talent_subscriptions')
export class TalentSubscription {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'talent_id' })
  talentId: string;

  @ApiPropertyOptional({ example: 9.99 })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number | null;

  @ApiProperty({ enum: TALENT_SUBSCRIPTION_STATUS_VALUES })
  @Column({
    type: 'varchar',
    length: 20,
    default: TalentSubscriptionStatus.FREE,
  })
  status: TalentSubscriptionStatus;

  @ApiProperty()
  @Column({ type: 'timestamp with time zone', name: 'start_date' })
  startDate: Date;

  @ApiProperty({ nullable: true })
  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'next_billing_date',
  })
  nextBillingDate: Date | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'talent_id' })
  talent: User;

  @OneToMany(() => Transaction, (txn) => txn.talentSubscription)
  transactions: Transaction[];
}
