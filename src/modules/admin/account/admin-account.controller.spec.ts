import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { AdminAccountController } from './admin-account.controller';
import { AdminAccountService } from './admin-account.service';

describe('AdminAccountController', () => {
  let controller: AdminAccountController;
  let service: { getMe: jest.Mock };

  beforeEach(async () => {
    service = { getMe: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminAccountController],
      providers: [{ provide: AdminAccountService, useValue: service }],
    }).compile();

    controller = moduleRef.get(AdminAccountController);
  });

  it('exposes GET /admin/me for all admin tiers without tier restriction', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdminAccountController)).toBe(
      'admin',
    );
    expect(Reflect.getMetadata(ROLES_KEY, AdminAccountController)).toEqual([
      UserRole.ADMIN,
    ]);
    expect(Reflect.getMetadata(PATH_METADATA, controller.me)).toBe('me');
    expect(Reflect.getMetadata(METHOD_METADATA, controller.me)).toBe(
      RequestMethod.GET,
    );
  });

  it('returns the read-only account settings payload for the global response transform', async () => {
    service.getMe.mockResolvedValue({
      id: 'admin-1',
      name: 'Ava Admin',
      email: 'ava@example.com',
      role_badge: 'Admin',
    });

    await expect(controller.me('admin-1')).resolves.toEqual({
      id: 'admin-1',
      name: 'Ava Admin',
      email: 'ava@example.com',
      role_badge: 'Admin',
    });
    expect(service.getMe).toHaveBeenCalledWith('admin-1');
  });
});
