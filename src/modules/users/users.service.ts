import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type {
  CreateVerifiedUserWithOauthLinkParams,
  UserOauthProvisioning,
} from './user-oauth-provisioning.types';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { UserModelAction } from './actions/user.action';
import { CreateUserDto } from './dto/create-user.dto';
import { PaginationDto } from './dto/pagination.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserRole } from './entities/user.entity';
import { OAuthUserModelAction } from './actions/user-oauth.action';
import {
  AccountDeletionAudit,
  AccountDeletionType,
} from './entities/account-deletion-audit.entity';
import { OAuthUser } from './entities/user-oauth.entity';
import {
  ConflictError,
  ErrorMessages,
  InternalServerError,
  NotFoundError,
} from '../../shared';
import { normalizeEmail } from '../../common/transforms/normalize-email';
import type { OAuthSignupRole } from '../auth/oauth-signup-role';
import { OAuthSignupRoleRequiredException } from '../auth/exceptions/oauth-signup-role-required.exception';

const NO_TRANSACTION = {
  transactionOptions: { useTransaction: false as const },
};

function isPostgresUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const code =
    (err as QueryFailedError & { code?: string }).code ??
    (err.driverError as { code?: string } | undefined)?.code;
  return code === '23505';
}

export type OAuthProviderProfileInput = {
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export const OAUTH_DEFAULT_COUNTRY = 'Unknown';

export type AccountDeletionMetadata = {
  ip_address?: string | null;
  user_agent?: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly userModelAction: UserModelAction,
    @InjectRepository(OAuthUser)
    private readonly oauthRepository: Repository<OAuthUser>,
    private readonly oauthUserModelAction: OAuthUserModelAction,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const normalizedEmail = normalizeEmail(dto.email) as string;
    const existing = await this.userModelAction.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictError(ErrorMessages.USER.EMAIL_ALREADY_REGISTERED);
    }

    const passwordHash = await argon2.hash(dto.password);
    const signupReason =
      dto.signupReason == null || dto.signupReason.trim() === ''
        ? null
        : dto.signupReason.trim();

    try {
      return await this.userModelAction.create({
        ...NO_TRANSACTION,
        createPayload: {
          email: normalizedEmail,
          password: passwordHash,
          first_name: dto.firstName,
          last_name: dto.lastName,
          country: dto.country,
          avatar_url: dto.profilePicUrl ?? null,
          is_verified: false,
          onboarding_complete: false,
          role: dto.role ?? UserRole.TALENT,
          signup_reason: signupReason,
        },
      });
    } catch (err) {
      if (isPostgresUniqueViolation(err)) {
        throw new ConflictError(ErrorMessages.USER.EMAIL_ALREADY_REGISTERED);
      }
      throw err;
    }
  }

  findAll(pagination: PaginationDto) {
    return this.userModelAction.list({
      paginationPayload: { page: pagination.page!, limit: pagination.limit! },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userModelAction.get({
      identifierOptions: { id },
    });
    if (!user) throw new NotFoundError(ErrorMessages.USER.NOT_FOUND(id));
    return user;
  }

  findOneOrNull(id: string): Promise<User | null> {
    return this.userModelAction.get({
      identifierOptions: { id },
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userModelAction.findByEmail(normalizeEmail(email) as string);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    await this.findOne(id);

    const { profilePicUrl, ...userDto } = dto;
    const payload: Partial<User> = {
      ...userDto,
      ...(profilePicUrl !== undefined ? { avatar_url: profilePicUrl } : {}),
    };
    if (dto.password) {
      payload.password = await argon2.hash(dto.password);
    }

    const updated = await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: payload,
    });
    if (!updated) {
      throw new InternalServerError(ErrorMessages.USER.UPDATE_FAILED);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.userModelAction.delete({
      ...NO_TRANSACTION,
      identifierOptions: { id },
    });
  }

  async softDeleteAccountWithAudit(
    id: string,
    metadata: AccountDeletionMetadata = {},
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const auditRepo = manager.getRepository(AccountDeletionAudit);
      const user = await userRepo.findOne({ where: { id } });
      if (!user) throw new NotFoundError(ErrorMessages.USER.NOT_FOUND(id));

      await auditRepo.save(
        auditRepo.create({
          user_id: user.id,
          email_at_deletion: user.email,
          first_name_at_deletion: user.first_name,
          last_name_at_deletion: user.last_name,
          role: user.role,
          country: user.country,
          ip_address: metadata.ip_address ?? null,
          user_agent: metadata.user_agent ?? null,
          deletion_type: AccountDeletionType.SELF_SERVICE,
          deleted_by_user_id: user.id,
        }),
      );

      await userRepo.update(
        { id },
        {
          email: `deleted+${id}@deleted.local`,
          refreshTokenHash: null,
          avatar_url: null,
        },
      );
      await userRepo.softDelete({ id });
    });
  }

  async updateEmail(id: string, email: string): Promise<User> {
    const normalizedEmail = normalizeEmail(email) as string;
    try {
      await this.userModelAction.update({
        ...NO_TRANSACTION,
        identifierOptions: { id },
        updatePayload: { email: normalizedEmail, refreshTokenHash: null },
      });
    } catch (err) {
      if (isPostgresUniqueViolation(err)) {
        throw new ConflictError(ErrorMessages.USER.EMAIL_ALREADY_REGISTERED);
      }
      throw err;
    }
    return this.findOne(id);
  }

  async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: { refreshTokenHash: hash },
    });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: { password: passwordHash, refreshTokenHash: null },
    });
  }

  async recordLastLogin(id: string): Promise<void> {
    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: { last_login_at: new Date() },
    });
  }

  async markVerified(id: string): Promise<User> {
    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: { is_verified: true },
    });
    return this.findOne(id);
  }

  async updateAvatar(id: string, avatarUrl: string): Promise<void> {
    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: { avatar_url: avatarUrl },
    });
  }

  async markOnboardingComplete(id: string): Promise<User> {
    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: { onboarding_complete: true },
    });
    return this.findOne(id);
  }

  async getUserForOnboarding(
    manager: EntityManager,
    id: string,
  ): Promise<User> {
    const user = await manager.findOne(User, {
      where: { id },
    });
    if (!user) {
      throw new NotFoundError(ErrorMessages.USER.NOT_FOUND(id));
    }
    return user;
  }

  async markOnboardingCompleteWithManager(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    await manager.update(User, { id }, { onboarding_complete: true });
  }

  rotateRefreshTokenHash(
    id: string,
    currentHash: string,
    nextHash: string,
  ): Promise<boolean> {
    return this.userModelAction.rotateRefreshTokenHash(
      id,
      currentHash,
      nextHash,
    );
  }

  async findOauthAccountWithUser(
    provider: string,
    providerId: string,
  ): Promise<{ oauth: OAuthUser; user: User } | null> {
    const oauth = await this.oauthRepository.findOne({
      where: { provider, provider_id: providerId },
      relations: ['user'],
    });
    if (!oauth?.user) return null;
    return { oauth, user: oauth.user };
  }

  async createVerifiedUserWithOauthLink(
    params: CreateVerifiedUserWithOauthLinkParams,
  ): Promise<User> {
    const provisioning = this.userModelAction as UserOauthProvisioning;
    return await provisioning.createVerifiedUserWithOauthLink(params);
  }

  async linkOauthAccountToUser(
    userId: string,
    provider: string,
    providerId: string,
  ): Promise<void> {
    try {
      await this.oauthRepository.save(
        this.oauthRepository.create({
          user_id: userId,
          provider,
          provider_id: providerId,
        }),
      );
    } catch (err) {
      if (!isPostgresUniqueViolation(err)) {
        throw err;
      }
      const byExternal = await this.findOauthAccountWithUser(
        provider,
        providerId,
      );
      if (byExternal?.user.id === userId) {
        return;
      }
      const forUserProvider = await this.oauthRepository.findOne({
        where: { user_id: userId, provider },
      });
      if (forUserProvider?.provider_id === providerId) {
        return;
      }
      throw err;
    }
  }

  /**
   * OAuth callback resolution: existing provider link, auto-link by email, or new user.
   */
  async resolveOAuthUserFromProviderProfile(
    provider: string,
    profile: OAuthProviderProfileInput,
    signupRole?: OAuthSignupRole,
  ): Promise<User> {
    const linked = await this.findOauthAccountWithUser(
      provider,
      profile.providerId,
    );
    if (linked) {
      return linked.user;
    }

    const byEmail = await this.findByEmail(profile.email);
    if (byEmail) {
      if (!byEmail.is_verified) {
        await this.markVerified(byEmail.id);
      }
      await this.linkOauthAccountToUser(
        byEmail.id,
        provider,
        profile.providerId,
      );
      return this.findOne(byEmail.id);
    }

    const normalizedEmail = profile.email.toLowerCase().trim();

    try {
      if (!signupRole) {
        throw new OAuthSignupRoleRequiredException();
      }
      return await this.createVerifiedUserWithOauthLink({
        email: normalizedEmail,
        first_name: profile.firstName,
        last_name: profile.lastName,
        country: OAUTH_DEFAULT_COUNTRY,
        avatar_url: profile.avatarUrl,
        provider,
        providerId: profile.providerId,
        role: signupRole,
      });
    } catch (err) {
      if (!isPostgresUniqueViolation(err)) {
        throw err;
      }
      const raced = await this.findByEmail(profile.email);
      if (!raced) {
        throw err;
      }
      if (!raced.is_verified) {
        await this.markVerified(raced.id);
      }
      await this.linkOauthAccountToUser(raced.id, provider, profile.providerId);
      return this.findOne(raced.id);
    }
  }
}
