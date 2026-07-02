import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('admin_email_change_audits')
@Index('IDX_admin_email_change_audits_target_user_id', ['target_user_id'])
export class AdminEmailChangeAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  target_user_id: string;

  @Column({ type: 'varchar', length: 255 })
  previous_email: string;

  @Column({ type: 'varchar', length: 255 })
  new_email: string;

  @Column({ type: 'uuid' })
  changed_by_user_id: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  changed_at: Date;
}
