import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ai_usage_logs')
@Index(['tag', 'created_at'])
@Index(['created_at'])
export class AiUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Caller-supplied label, e.g. rubric_scoring_full, guidance_report */
  @Column({ type: 'varchar', length: 64 })
  tag: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  model_id: string | null;

  @Column({ type: 'int', nullable: true })
  input_tokens: number | null;

  @Column({ type: 'int', nullable: true })
  output_tokens: number | null;

  @Column({ type: 'int', nullable: true })
  total_tokens: number | null;

  /** Raw cost in USD as reported by the provider */
  @Column({ type: 'numeric', precision: 18, scale: 10, nullable: true })
  cost_usd: number | null;

  @Column({ type: 'int' })
  duration_ms: number;

  @CreateDateColumn()
  created_at: Date;
}
