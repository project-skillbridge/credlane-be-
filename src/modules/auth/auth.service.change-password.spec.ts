import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { ErrorMessages, SuccessMessages } from '../../shared';
import type { ChangePasswordDto } from './dto/change-password.dto';

jest.mock('argon2');

const argon2Verify = argon2.verify as jest.MockedFunction<typeof argon2.verify>;
const argon2Hash = argon2.hash as jest.MockedFunction<typeof argon2.hash>;

describe('AuthService.changePassword', () => {
  let service: AuthService;

  let usersService: {
    findOne: jest.Mock;
    updatePassword: jest.Mock;
  };

  const userId = 'user-abc';
  const currentPasswordHash = '$argon2id$hashed-current';
  const newPasswordHash = '$argon2id$hashed-new';

  const dto: ChangePasswordDto = {
    currentPassword: 'OldP@ssword1',
    newPassword: 'NewP@ssword2',
    confirmNewPassword: 'NewP@ssword2',
  };

  beforeEach(() => {
    usersService = {
      findOne: jest.fn(),
      updatePassword: jest.fn().mockResolvedValue(undefined),
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

    jest.clearAllMocks();
  });

  it('returns success and calls updatePassword with a fresh hash', async () => {
    usersService.findOne.mockResolvedValue({
      id: userId,
      password: currentPasswordHash,
    });
    argon2Verify
      .mockResolvedValueOnce(true) // currentPassword valid
      .mockResolvedValueOnce(false); // newPassword != currentPassword
    argon2Hash.mockResolvedValue(newPasswordHash as never);

    const result = await service.changePassword(userId, dto);

    expect(result).toEqual({
      status: 'success',
      message: SuccessMessages.AUTH.PASSWORD_CHANGED,
    });
    expect(usersService.updatePassword).toHaveBeenCalledWith(
      userId,
      newPasswordHash,
    );
  });

  it('throws 400 when currentPassword is wrong', async () => {
    usersService.findOne.mockResolvedValue({
      id: userId,
      password: currentPasswordHash,
    });
    argon2Verify.mockResolvedValueOnce(false); // wrong current password

    await expect(
      service.changePassword(userId, { ...dto, currentPassword: 'WrongOld1!' }),
    ).rejects.toMatchObject({
      message: ErrorMessages.AUTH.WRONG_CURRENT_PASSWORD,
    });
    expect(usersService.updatePassword).not.toHaveBeenCalled();
  });

  it('throws 400 when newPassword matches the current password', async () => {
    usersService.findOne.mockResolvedValue({
      id: userId,
      password: currentPasswordHash,
    });
    argon2Verify
      .mockResolvedValueOnce(true) // currentPassword valid
      .mockResolvedValueOnce(true); // newPassword == currentPassword → same

    await expect(
      service.changePassword(userId, {
        ...dto,
        newPassword: dto.currentPassword,
        confirmNewPassword: dto.currentPassword,
      }),
    ).rejects.toMatchObject({
      message: ErrorMessages.AUTH.SAME_PASSWORD,
    });
    expect(usersService.updatePassword).not.toHaveBeenCalled();
  });

  it('throws 400 for an OAuth account that has no password (null)', async () => {
    usersService.findOne.mockResolvedValue({ id: userId, password: null });

    await expect(service.changePassword(userId, dto)).rejects.toMatchObject({
      message: ErrorMessages.AUTH.OAUTH_ACCOUNT_NO_PASSWORD,
    });
    expect(argon2Verify).not.toHaveBeenCalled();
    expect(usersService.updatePassword).not.toHaveBeenCalled();
  });

  it('nullifies refreshTokenHash by delegating to updatePassword (session revocation)', async () => {
    // updatePassword already sets refreshTokenHash=null in UsersService.
    // This test confirms changePassword always calls updatePassword (not setRefreshTokenHash separately).
    usersService.findOne.mockResolvedValue({
      id: userId,
      password: currentPasswordHash,
    });
    argon2Verify.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    argon2Hash.mockResolvedValue(newPasswordHash as never);

    await service.changePassword(userId, dto);

    // updatePassword is called exactly once; session revocation is its responsibility.
    expect(usersService.updatePassword).toHaveBeenCalledTimes(1);
    expect(usersService.updatePassword).toHaveBeenCalledWith(
      userId,
      newPasswordHash,
    );
  });
});
