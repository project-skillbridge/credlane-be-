import { ForbiddenException, Injectable } from '@nestjs/common';
import { AdminTier, UserRole } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';

const ADMIN_ROLE_BADGE_LABELS: Record<AdminTier, string> = {
  [AdminTier.SUPER_ADMIN]: 'Super Admin',
  [AdminTier.ADMIN]: 'Admin',
  [AdminTier.REVIEWER]: 'Reviewer',
};

@Injectable()
export class AdminAccountService {
  constructor(private readonly usersService: UsersService) {}

  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  async getMe(userId: string): Promise<{
    id: string;
    name: string;
    email: string;
    role: UserRole.ADMIN;
    admin_tier: AdminTier;
    role_badge: string;
  }> {
    const user = await this.usersService.findOne(userId);
    if (user.role !== UserRole.ADMIN || user.admin_tier === null) {
      throw new ForbiddenException('Admin account required');
    }

    return {
      id: user.id,
      name: user.fullname,
      email: user.email,
      role: UserRole.ADMIN,
      admin_tier: user.admin_tier,
      role_badge: ADMIN_ROLE_BADGE_LABELS[user.admin_tier],
    };
  }
}
