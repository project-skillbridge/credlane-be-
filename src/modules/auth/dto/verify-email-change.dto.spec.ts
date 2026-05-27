import { validate } from 'class-validator';
import { VerifyEmailChangeDto } from './verify-email-change.dto';

describe('VerifyEmailChangeDto', () => {
  const buildDto = (otp: string) => {
    const dto = new VerifyEmailChangeDto();
    dto.newEmail = 'new.email@example.com';
    dto.otp = otp;
    return dto;
  };

  it('accepts a six-digit OTP', async () => {
    await expect(validate(buildDto('123456'))).resolves.toHaveLength(0);
  });

  it('rejects non-digit six-character OTPs', async () => {
    const errors = await validate(buildDto('12AB56'));

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'otp' })]),
    );
  });

  it('rejects OTPs that are not exactly six characters', async () => {
    const errors = await validate(buildDto('12345'));

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'otp' })]),
    );
  });
});
