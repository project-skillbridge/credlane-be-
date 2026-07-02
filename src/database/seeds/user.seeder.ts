import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { env } from '../../config/env';
import {
  AdminTier,
  User,
  UserRole,
} from '../../modules/users/entities/user.entity';
import { Seeder } from './seeder.interface';

interface AdminSeedEntry {
  email: string;
  password: string;
  full_name: string;
  admin_tier?: 'SUPER_ADMIN' | 'ADMIN' | 'REVIEWER';
}

const VALID_TIERS = new Set<string>(['SUPER_ADMIN', 'ADMIN', 'REVIEWER']);

function resolveAdminEntries(): AdminSeedEntry[] {
  if (env.SEED_ADMINS) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(env.SEED_ADMINS);
    } catch {
      throw new Error(
        '[UserSeeder] SEED_ADMINS is not valid JSON. Expected a JSON array.',
      );
    }
    if (!Array.isArray(parsed)) {
      throw new Error('[UserSeeder] SEED_ADMINS must be a JSON array.');
    }
    return (parsed as Record<string, unknown>[]).map((entry, i) => {
      const { email, password, full_name, admin_tier } = entry;
      if (typeof email !== 'string' || !email.includes('@'))
        throw new Error(`[UserSeeder] SEED_ADMINS[${i}].email is invalid`);
      if (typeof password !== 'string' || password.length < 12)
        throw new Error(
          `[UserSeeder] SEED_ADMINS[${i}].password must be at least 12 characters`,
        );
      if (typeof full_name !== 'string' || !full_name.trim())
        throw new Error(`[UserSeeder] SEED_ADMINS[${i}].full_name is required`);
      if (admin_tier !== undefined && !VALID_TIERS.has(admin_tier as string))
        throw new Error(
          `[UserSeeder] SEED_ADMINS[${i}].admin_tier must be SUPER_ADMIN | ADMIN | REVIEWER`,
        );
      return {
        email: email.toLowerCase().trim(),
        password,
        full_name: full_name.trim(),
        admin_tier:
          (admin_tier as AdminSeedEntry['admin_tier']) ?? 'SUPER_ADMIN',
      };
    });
  }

  return [
    {
      email: env.SEED_ADMIN_EMAIL,
      password: env.SEED_ADMIN_PASSWORD,
      full_name: env.SEED_ADMIN_FULL_NAME,
      admin_tier: 'SUPER_ADMIN',
    },
  ];
}

function splitName(fullName: string): {
  first_name: string;
  last_name: string;
} {
  const [firstName, ...lastNameParts] = fullName.trim().split(/\s+/);
  return {
    first_name: firstName || 'Admin',
    last_name: lastNameParts.join(' ') || 'User',
  };
}

export const userSeeder: Seeder = {
  name: 'UserSeeder',
  async run(dataSource: DataSource) {
    const repository = dataSource.getRepository(User);
    const entries = resolveAdminEntries();

    for (const entry of entries) {
      const existing = await repository.findOne({
        where: { email: entry.email },
      });
      if (existing) {
        console.log(`[UserSeeder] ${entry.email} already exists — skipping`);
        continue;
      }

      const tierMap: Record<string, AdminTier> = {
        SUPER_ADMIN: AdminTier.SUPER_ADMIN,
        ADMIN: AdminTier.ADMIN,
        REVIEWER: AdminTier.REVIEWER,
      };

      const { first_name, last_name } = splitName(entry.full_name);
      const user = repository.create({
        email: entry.email,
        password: await argon2.hash(entry.password),
        first_name,
        last_name,
        country: 'Nigeria',
        avatar_url: null,
        is_verified: true,
        onboarding_complete: true,
        role: UserRole.ADMIN,
        admin_tier: tierMap[entry.admin_tier ?? 'SUPER_ADMIN'],
      });
      await repository.save(user);
      console.log(
        `[UserSeeder] created ${entry.admin_tier ?? 'SUPER_ADMIN'} — ${entry.email}`,
      );
    }
  },
};
