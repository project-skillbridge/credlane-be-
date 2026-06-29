import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmployerSubscription } from './employer-subscription.entity';

@Entity('employer_packages')
export class EmployerPackage {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Free' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiProperty({ example: 0 })
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @ApiProperty({ example: 2 })
  @Column({ type: 'int', nullable: true })
  offer_limit: number | null;

  @ApiPropertyOptional()
  @Column({ type: 'jsonb', nullable: true })
  features: Record<string, unknown> | null;

  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false })
  is_free: boolean;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  @OneToMany(() => EmployerSubscription, (sub) => sub.package)
  subscriptions: EmployerSubscription[];
}
