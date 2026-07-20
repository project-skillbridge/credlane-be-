import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EmployerRole } from '../../employer-roles/entities/employer-role.entity';
import { User } from '../../users/entities/user.entity';

@Entity('talent_role_interests')
@Unique('UQ_talent_role_interests_talent_role', ['talent_user_id', 'role_id'])
@Index('IDX_talent_role_interests_talent_created', [
  'talent_user_id',
  'created_at',
])
@Index('IDX_talent_role_interests_role', ['role_id'])
export class TalentRoleInterest {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  talent_user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'talent_user_id' })
  talent: User;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  role_id: string;

  @ManyToOne(() => EmployerRole, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: EmployerRole;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
