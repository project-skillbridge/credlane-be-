import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import { SupportTicketMessage } from './support-ticket-message.entity';

export enum SupportTicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
}

export const SUPPORT_TICKET_STATUS_VALUES = [
  SupportTicketStatus.OPEN,
  SupportTicketStatus.IN_PROGRESS,
  SupportTicketStatus.RESOLVED,
] as const;

export enum SupportTicketType {
  ACCOUNT = 'account',
  ASSESSMENT = 'assessment',
  EMPLOYER = 'employer',
  PAYMENT = 'payment',
  TECHNICAL = 'technical',
  OTHER = 'other',
}

export const SUPPORT_TICKET_TYPE_VALUES = [
  SupportTicketType.ACCOUNT,
  SupportTicketType.ASSESSMENT,
  SupportTicketType.EMPLOYER,
  SupportTicketType.PAYMENT,
  SupportTicketType.TECHNICAL,
  SupportTicketType.OTHER,
] as const;

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  ticket_id: string;

  @Column({ type: 'uuid', nullable: true })
  submitted_by_user_id: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'submitted_by_user_id' })
  submitted_by: User | null;

  @Column({ type: 'varchar', length: 255 })
  submitter_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  submitter_email: string | null;

  @Column({ type: 'varchar', length: 20 })
  submitter_role: string;

  @Column({ type: 'varchar', length: 40 })
  type: SupportTicketType;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'varchar', length: 20, default: SupportTicketStatus.OPEN })
  status: SupportTicketStatus;

  @Column({ type: 'uuid', nullable: true })
  assigned_admin_id: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_admin_id' })
  assigned_admin: User | null;

  @OneToMany(() => SupportTicketMessage, (message) => message.ticket)
  messages: SupportTicketMessage[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updated_at: Date;
}
