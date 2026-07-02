import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminTiersGuard } from './admin-tiers.guard';
import { AdminTier } from '../../users/entities/user.entity';

describe('AdminTiersGuard', () => {
  const buildContext = (user?: { admin_tier: AdminTier | null }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  const buildGuard = (requiredTiers: AdminTier[] | undefined) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredTiers),
    };
    return new AdminTiersGuard(reflector as unknown as Reflector);
  };

  it('allows access when no tiers are required on the route', () => {
    const guard = buildGuard(undefined);
    expect(guard.canActivate(buildContext({ admin_tier: null }))).toBe(true);
  });

  it('allows access when the user tier matches a required tier', () => {
    const guard = buildGuard([AdminTier.SUPER_ADMIN]);
    expect(
      guard.canActivate(buildContext({ admin_tier: AdminTier.SUPER_ADMIN })),
    ).toBe(true);
  });

  it('throws when the user tier does not match', () => {
    const guard = buildGuard([AdminTier.SUPER_ADMIN]);
    expect(() =>
      guard.canActivate(buildContext({ admin_tier: AdminTier.REVIEWER })),
    ).toThrow();
  });

  it('throws when the user has no admin tier at all', () => {
    const guard = buildGuard([AdminTier.SUPER_ADMIN]);
    expect(() =>
      guard.canActivate(buildContext({ admin_tier: null })),
    ).toThrow();
  });
});
