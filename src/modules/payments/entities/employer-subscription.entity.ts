import { ApiProperty } from '@nestjs/swagger';
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
import { EmployerPackage } from './employer-package.entity';
import { Transaction } from './transaction.entity';

export enum EmployerSubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
  FREE = 'free',
}

export const EMPLOYER_SUBSCRIPTION_STATUS_VALUES = [
  EmployerSubscriptionStatus.ACTIVE,
  EmployerSubscriptionStatus.PAST_DUE,
  EmployerSubscriptionStatus.CANCELLED,
  EmployerSubscriptionStatus.FREE,
] as const;

@Entity('employer_subscriptions')
export class EmployerSubscription {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'employer_id' })
  employerId: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid', name: 'package_id' })
  packageId: string;

  @ApiProperty({ enum: EMPLOYER_SUBSCRIPTION_STATUS_VALUES })
  @Column({
    type: 'varchar',
    length: 20,
    default: EmployerSubscriptionStatus.FREE,
  })
  status: EmployerSubscriptionStatus;

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

  @ApiProperty({ nullable: true })
  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    name: 'grace_period_ends_at',
  })
  gracePeriodEndsAt: Date | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employer_id' })
  employer: User;

  @ManyToOne(() => EmployerPackage, (pkg) => pkg.subscriptions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'package_id' })
  package: EmployerPackage;

  @OneToMany(() => Transaction, (txn) => txn.employerSubscription)
  transactions: Transaction[];
}
