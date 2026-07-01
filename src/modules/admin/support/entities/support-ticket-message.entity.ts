import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import { SupportTicket } from './support-ticket.entity';

export enum SupportTicketMessageAuthorType {
  SUBMITTER = 'submitter',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

export const SUPPORT_TICKET_MESSAGE_AUTHOR_TYPE_VALUES = [
  SupportTicketMessageAuthorType.SUBMITTER,
  SupportTicketMessageAuthorType.ADMIN,
  SupportTicketMessageAuthorType.SYSTEM,
] as const;

@Entity('support_ticket_messages')
export class SupportTicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ticket_id: string;

  @ManyToOne(() => SupportTicket, (ticket) => ticket.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ticket_id' })
  ticket: SupportTicket;

  @Column({ type: 'varchar', length: 20 })
  author_type: SupportTicketMessageAuthorType;

  @Column({ type: 'uuid', nullable: true })
  author_user_id: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_user_id' })
  author: User | null;

  @Column({ type: 'varchar', length: 255 })
  author_name: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  created_at: Date;
}
