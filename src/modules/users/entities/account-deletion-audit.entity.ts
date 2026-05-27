import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from './user.entity';

export enum AccountDeletionType {
  SELF_SERVICE = 'self_service',
  ADMIN = 'admin',
}

@Entity('account_deletion_audits')
@Index('IDX_account_deletion_audits_user_id', ['user_id'])
@Index('IDX_account_deletion_audits_email_at_deletion', ['email_at_deletion'])
export class AccountDeletionAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 255 })
  email_at_deletion: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  first_name_at_deletion: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  last_name_at_deletion: string | null;

  @Column({ type: 'varchar', length: 20 })
  role: UserRole;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: AccountDeletionType.SELF_SERVICE,
  })
  deletion_type: AccountDeletionType;

  @Column({ type: 'uuid', nullable: true })
  deleted_by_user_id: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  deleted_at: Date;
}
