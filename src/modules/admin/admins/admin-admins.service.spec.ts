import { ForbiddenError, NotFoundError } from '../../../shared';
import { AdminTier, UserRole } from '../../users/entities/user.entity';
import { AdminAdminsService } from './admin-admins.service';

const buildAdminUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'admin-1',
  email: 'admin@credlane.com',
  password: 'hashed-password',
  first_name: 'Ada',
  last_name: 'Admin',
  fullname: 'Ada Admin',
  role: UserRole.ADMIN,
  admin_tier: AdminTier.ADMIN,
  is_active: true,
  last_login_at: null,
  ...overrides,
});

describe('AdminAdminsService', () => {
  let userRepo: {
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
  };
  let emailChangeAuditRepo: { create: jest.Mock; save: jest.Mock };
  let usersService: { findByEmail: jest.Mock };
  let passwordResetQueue: { enqueue: jest.Mock };
  let mailService: { send: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let service: AdminAdminsService;

  beforeEach(() => {
    userRepo = {
      createQueryBuilder: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      create: jest.fn((payload) => payload),
    };
    emailChangeAuditRepo = {
      create: jest.fn((payload) => payload),
      save: jest.fn(),
    };
    usersService = { findByEmail: jest.fn() };
    passwordResetQueue = { enqueue: jest.fn() };
    mailService = { send: jest.fn().mockResolvedValue(undefined) };
    dataSource = {
      transaction: jest.fn(async (cb) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === Object) return userRepo;
            return emailChangeAuditRepo;
          },
        }),
      ),
    };

    service = new AdminAdminsService(
      userRepo as never,
      emailChangeAuditRepo as never,
      usersService as never,
      passwordResetQueue as never,
      mailService as never,
      dataSource as never,
    );
  });

  describe('findAll', () => {
    it('maps admin users to the list contract', async () => {
      const user = buildAdminUser({
        last_login_at: new Date('2026-01-15T10:00:00.000Z'),
      });
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[user], 1]),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items[0]).toEqual({
        id: 'admin-1',
        name: 'Ada Admin',
        email: 'admin@credlane.com',
        role: AdminTier.ADMIN,
        last_login: '2026-01-15T10:00:00.000Z',
        status: 'active',
      });
      expect(result.totalPages).toBe(1);
    });

    it('derives pending_setup when password is null', async () => {
      const user = buildAdminUser({ password: null });
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[user], 1]),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({});

      expect(result.items[0].status).toBe('pending_setup');
    });
  });

  describe('invite', () => {
    it('creates an active admin with a hashed temp password and sends invite email', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const saved = buildAdminUser({
        id: 'new-admin',
        email: 'new@credlane.com',
        password: 'argon2-hash',
        first_name: 'New',
        last_name: 'Admin',
        fullname: 'New Admin',
      });
      userRepo.save.mockResolvedValue(saved);

      const result = await service.invite(
        { email: 'new@credlane.com' },
        'actor-1',
      );

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@credlane.com',
          password: expect.any(String),
          role: UserRole.ADMIN,
          admin_tier: AdminTier.ADMIN,
        }),
      );
      const savedCall = userRepo.save.mock.calls[0][0];
      expect(savedCall.password).not.toBeNull();
      expect(passwordResetQueue.enqueue).not.toHaveBeenCalled();
      expect(result.temp_password).toBeDefined();
      expect(typeof result.temp_password).toBe('string');
      expect(result.account.status).toBe('active');
    });
  });

  describe('changeRole', () => {
    it('requires confirmation when downgrading a super admin', async () => {
      userRepo.findOne.mockResolvedValue(
        buildAdminUser({ admin_tier: AdminTier.SUPER_ADMIN }),
      );

      await expect(
        service.changeRole('admin-1', { role: AdminTier.ADMIN }, 'actor-1'),
      ).rejects.toThrow('Confirm downgrade');
    });
  });

  describe('deactivate', () => {
    it('prevents self-deactivation', async () => {
      await expect(
        service.deactivate('actor-1', 'actor-1'),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('deactivates another admin account', async () => {
      const user = buildAdminUser({ id: 'other-admin' });
      userRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce({ ...user, is_active: false });
      userRepo.count.mockResolvedValue(2);

      const result = await service.deactivate('other-admin', 'actor-1');

      expect(userRepo.update).toHaveBeenCalledWith(
        { id: 'other-admin' },
        { is_active: false, refreshTokenHash: null },
      );
      expect(result.account.status).toBe('deactivated');
    });
  });

  describe('getManagedAdminOrThrow', () => {
    it('throws when admin account is missing', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.resetPassword('missing-id')).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});
