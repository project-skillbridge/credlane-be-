import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmployerSubscription } from './employer-subscription.entity';
import { TalentSubscription } from './talent-subscription.entity';

export enum TransactionStatus {
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export const TRANSACTION_STATUS_VALUES = [
  TransactionStatus.SUCCESSFUL,
  TransactionStatus.FAILED,
  TransactionStatus.REFUNDED,
] as const;

export enum SubscriberType {
  EMPLOYER = 'employer',
  TALENT = 'talent',
}

export const SUBSCRIBER_TYPE_VALUES = [
  SubscriberType.EMPLOYER,
  SubscriberType.TALENT,
] as const;

@Entity('transactions')
export class Transaction {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid', name: 'subscriber_id' })
  subscriberId: string;

  @ApiProperty({ enum: SUBSCRIBER_TYPE_VALUES })
  @Column({ type: 'varchar', length: 20, name: 'subscriber_type' })
  subscriberType: SubscriberType;

  @ApiProperty({ example: 49.99 })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @ApiProperty({ example: 'USD' })
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @ApiProperty({ enum: TRANSACTION_STATUS_VALUES })
  @Column({ type: 'varchar', length: 20 })
  status: TransactionStatus;

  @Column({ type: 'uuid', nullable: true, name: 'employer_subscription_id' })
  employerSubscriptionId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'talent_subscription_id' })
  talentSubscriptionId: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @ManyToOne(() => EmployerSubscription, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'employer_subscription_id' })
  employerSubscription: EmployerSubscription | null;

  @ManyToOne(() => TalentSubscription, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'talent_subscription_id' })
  talentSubscription: TalentSubscription | null;
}
