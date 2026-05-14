import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('employer_profiles')
export class EmployerProfile {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  user_id: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** New profile endpoint fields (BE-ONB-EMP-001) */
  @ApiProperty({ example: 'Founder', nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  employer_type: string | null;

  @ApiProperty({ example: ['Engineering', 'Design'], nullable: true, type: [String] })
  @Column({ type: 'text', array: true, nullable: true })
  hiring_roles: string[] | null;

  @ApiProperty({ example: ['Nigeria', 'Remote Worldwide'], nullable: true, type: [String] })
  @Column({ type: 'text', array: true, nullable: true })
  hiring_locations: string[] | null;

  /** Legacy onboarding field (lowercase) */
  @ApiProperty({ example: 'recruiter', nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  joining_as: string | null;

  @ApiProperty({
    example: ['frontend_developer', 'backend_developer'],
    nullable: true,
    type: [String],
  })
  @Column({ type: 'text', array: true, nullable: true })
  desired_roles: string[] | null;

  @ApiProperty({ example: 'Nigeria', nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  region: string | null;

  @ApiProperty({ example: '6_10', nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  hiring_count_range: string | null;

  @ApiProperty({ example: 'https://acmelabs.example', nullable: true })
  @Column({ type: 'varchar', length: 500, nullable: true })
  company_website: string | null;

  /** Legacy fields kept for backward compatibility */
  @ApiProperty({ example: 'Acme Labs', nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  company_name: string | null;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  company_size: string | null;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  industry: string | null;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  website_url: string | null;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  company_description: string | null;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  hiring_region: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updated_at: Date;
}