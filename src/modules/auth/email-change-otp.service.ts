import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { env } from '../../config/env';
import { normalizeEmail } from '../../common/transforms/normalize-email';
import { parseDurationToMs } from '../../shared/runtime/duration';
import { EmailChangeOtp } from './entities/email-change-otp.entity';

export interface IssuedEmailChangeOtp {
  code: string;
  expiresAt: Date;
}

@Injectable()
export class EmailChangeOtpService {
  constructor(
    @InjectRepository(EmailChangeOtp)
    private readonly repository: Repository<EmailChangeOtp>,
  ) {}

  async issue(
    userId: string,
    new_email: string,
  ): Promise<IssuedEmailChangeOtp> {
    const normalizedEmail = normalizeEmail(new_email) as string;
    await this.invalidateActiveOtps(userId);

    const code = this.generateCode();
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(env.VERIFICATION_OTP_EXPIRES_IN),
    );

    await this.repository.save(
      this.repository.create({
        userId,
        new_email: normalizedEmail,
        otpHash: await argon2.hash(code),
        expiresAt,
        usedAt: null,
      }),
    );

    return { code, expiresAt };
  }

  async consume(
    userId: string,
    new_email: string,
    code: string,
  ): Promise<boolean> {
    const normalizedEmail = normalizeEmail(new_email) as string;
    const latestOtp = await this.repository
      .createQueryBuilder('email_change_otp')
      .where('email_change_otp.user_id = :userId', { userId })
      .andWhere('email_change_otp.new_email = :new_email', {
        new_email: normalizedEmail,
      })
      .andWhere('email_change_otp.used_at IS NULL')
      .andWhere('email_change_otp.expires_at > NOW()')
      .orderBy('email_change_otp.created_at', 'DESC')
      .getOne();

    if (!latestOtp) return false;

    const matches = await argon2.verify(latestOtp.otpHash, code);
    if (!matches) return false;

    const result = await this.repository
      .createQueryBuilder()
      .update(EmailChangeOtp)
      .set({ usedAt: () => 'CURRENT_TIMESTAMP' })
      .where('id = :id', { id: latestOtp.id })
      .andWhere('used_at IS NULL')
      .execute();

    return (result.affected ?? 0) > 0;
  }

  private async invalidateActiveOtps(userId: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(EmailChangeOtp)
      .set({ usedAt: () => 'CURRENT_TIMESTAMP' })
      .where('user_id = :userId', { userId })
      .andWhere('used_at IS NULL')
      .andWhere('expires_at > NOW()')
      .execute();
  }

  private generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }
}
