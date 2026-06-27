import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { ADMIN_TIERS_KEY } from '../../../common/decorators/admin-tiers.decorator';
import { AdminTier } from '../../users/entities/user.entity';
import { ErrorMessages, ForbiddenError } from '../../../shared';

/**
 * Gates routes by AdminTier (super_admin/admin/reviewer). Independent of
 * RolesGuard — apply alongside @Roles(UserRole.ADMIN) for tier-scoped pages
 * like Payments and Admin Management.
 */
@Injectable()
export class AdminTiersGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTiers = this.reflector.getAllAndOverride<AdminTier[]>(
      ADMIN_TIERS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredTiers?.length) return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    const user = request.user;

    if (user?.admin_tier && requiredTiers.includes(user.admin_tier)) {
      return true;
    }

    throw new ForbiddenError(ErrorMessages.COMMON.INSUFFICIENT_PERMISSIONS);
  }
}
