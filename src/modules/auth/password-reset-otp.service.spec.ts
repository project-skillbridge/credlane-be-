import { PasswordResetOtpService } from './password-reset-otp.service';
import {
  PasswordResetOtp,
  PasswordResetOtpSource,
} from './entities/password-reset-otp.entity';
import { Repository } from 'typeorm';

describe('PasswordResetOtpService.countRecentRequests', () => {
  let service: PasswordResetOtpService;
  let queryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getCount: jest.Mock;
  };
  let repository: Pick<Repository<PasswordResetOtp>, 'createQueryBuilder'>;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };
    repository = {
      createQueryBuilder: jest.fn(() => queryBuilder as any),
    };
    service = new PasswordResetOtpService(
      repository as Repository<PasswordResetOtp>,
    );
  });

  it('queries by userId and the since date without filtering by request_source', async () => {
    queryBuilder.getCount.mockResolvedValue(3);

    const since = new Date('2026-05-23T09:00:00.000Z');
    const count = await service.countRecentRequests('user-1', since);

    expect(count).toBe(3);
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'password_reset_otp.user_id = :userId',
      { userId: 'user-1' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'password_reset_otp.created_at >= :since',
      { since },
    );
    // Must NOT filter by request_source — counts both INITIAL and RESEND rows.
    const andWhereCalls: string[] = queryBuilder.andWhere.mock.calls.map(
      (args: unknown[]) => String(args[0]),
    );
    expect(
      andWhereCalls.some((clause) => clause.includes('request_source')),
    ).toBe(false);
  });

  it('returns 0 when no recent rows exist', async () => {
    queryBuilder.getCount.mockResolvedValue(0);
    const count = await service.countRecentRequests('user-2', new Date());
    expect(count).toBe(0);
  });

  it('countRecentResends still filters by RESEND source independently', async () => {
    queryBuilder.getCount.mockResolvedValue(1);
    await service.countRecentResends('user-1', new Date());

    const andWhereCalls: string[] = queryBuilder.andWhere.mock.calls.map(
      (args: unknown[]) => String(args[0]),
    );
    expect(
      andWhereCalls.some((clause) => clause.includes('request_source')),
    ).toBe(true);
    const sourceCall = queryBuilder.andWhere.mock.calls.find(
      (args: unknown[]) => String(args[0]).includes('request_source'),
    );
    expect(sourceCall?.[1]).toEqual({
      requestSource: PasswordResetOtpSource.RESEND,
    });
  });
});
