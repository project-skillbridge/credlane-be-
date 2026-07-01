import { SetMetadata } from '@nestjs/common';
import { AdminTier } from '../../modules/users/entities/user.entity';

export const ADMIN_TIERS_KEY = 'adminTiers';
export const AdminTiers = (...tiers: AdminTier[]) =>
  SetMetadata(ADMIN_TIERS_KEY, tiers);
