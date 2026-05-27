import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService.deleteAccount', () => {
  let service: AuthService;
  let usersService: { softDeleteAccountWithAudit: jest.Mock };

  const userId = 'user-abc';
  const metadata = {
    ip_address: '127.0.0.1',
    user_agent: 'jest-agent',
  };

  beforeEach(() => {
    usersService = {
      softDeleteAccountWithAudit: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      usersService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('requires typed DELETE confirmation before deleting', async () => {
    await expect(
      service.deleteAccount(userId, { confirmation: '' }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(usersService.softDeleteAccountWithAudit).not.toHaveBeenCalled();
  });

  it('soft-deletes account after confirmation', async () => {
    const result = await service.deleteAccount(
      userId,
      { confirmation: 'DELETE' },
      metadata,
    );

    expect(usersService.softDeleteAccountWithAudit).toHaveBeenCalledWith(
      userId,
      metadata,
    );
    expect(result).toEqual({
      status: 'success',
      message: 'Account deleted',
    });
  });
});
