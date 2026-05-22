import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

export enum ContactRequestStatus {
  PENDING = 'pending',
  READ = 'read',
  RESPONDED = 'responded',
}

@Entity('employer_contact_requests')
@Index('IDX_employer_contact_requests_employer', ['employer_user_id'])
@Index('IDX_employer_contact_requests_candidate', ['candidate_user_id'])
export class EmployerContactRequest {
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
  candidate_user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_user_id' })
  candidate: User;

  @ApiProperty()
  @Column({ type: 'text' })
  message: string;

  @ApiProperty({ enum: ContactRequestStatus })
  @Column({
    type: 'enum',
    enum: ContactRequestStatus,
    enumName: 'contact_request_status_enum',
    default: ContactRequestStatus.PENDING,
  })
  status: ContactRequestStatus;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
