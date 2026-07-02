import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OAuthUser } from './user-oauth-account.entity';

export enum UserRole {
  ADMIN = 'admin',
  TALENT = 'talent',
  EMPLOYER = 'employer',
}

export const USER_ROLE_VALUES = [
  UserRole.ADMIN,
  UserRole.TALENT,
  UserRole.EMPLOYER,
] as const;

/**
 * Sub-classification for UserRole.ADMIN only. Null for talent/employer users.
 * Drives the CredLane Super Admin Dashboard's page access matrix.
 */
export enum AdminTier {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  REVIEWER = 'reviewer',
}

export const ADMIN_TIER_VALUES = [
  AdminTier.SUPER_ADMIN,
  AdminTier.ADMIN,
  AdminTier.REVIEWER,
] as const;

@Entity('users')
export class User {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string | null;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  first_name: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  last_name: string;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar_url: string | null;

  @ApiProperty({ example: 'Nigeria' })
  @Column({ type: 'varchar', length: 100 })
  country: string;

  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false })
  is_verified: boolean;

  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false })
  onboarding_complete: boolean;

  @ApiProperty()
  @Expose()
  get fullname(): string {
    return `${this.first_name} ${this.last_name}`.trim();
  }

  @ApiProperty({ enum: USER_ROLE_VALUES, default: UserRole.TALENT })
  @Column({ type: 'enum', enum: USER_ROLE_VALUES, default: UserRole.TALENT })
  role: UserRole;

  @ApiProperty({ enum: ADMIN_TIER_VALUES, required: false, nullable: true })
  @Column({
    type: 'enum',
    enum: ADMIN_TIER_VALUES,
    name: 'admin_tier',
    nullable: true,
  })
  admin_tier: AdminTier | null;

  @ApiProperty({ default: true })
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @ApiProperty({ required: false, nullable: true })
  @Column({
    type: 'timestamp with time zone',
    name: 'last_login_at',
    nullable: true,
  })
  last_login_at: Date | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'signup_reason',
  })
  signup_reason: string | null;

  @Exclude()
  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    name: 'refresh_token_hash',
  })
  refreshTokenHash: string | null;

  @OneToMany(() => OAuthUser, (oauthAccount: OAuthUser) => oauthAccount.user)
  oauthAccounts: OAuthUser[];

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  @Exclude()
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp with time zone' })
  deletedAt: Date | null;
}
