import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';
import { MailService } from './mail.service';
import type { BankExhaustedAlertPayload } from './mail.types';

@Injectable()
export class BankExhaustedAlertService {
  private readonly logger = new Logger(BankExhaustedAlertService.name);

  constructor(private readonly mailService: MailService) {}

  notify(payload: BankExhaustedAlertPayload): void {
    const recipients = this.resolveRecipients();
    if (recipients.length === 0) {
      return;
    }

    void this.mailService
      .sendBankExhaustedAlert({ ...payload, to: recipients })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to send bank exhausted alert: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }

  resolveRecipients(): string[] {
    const raw = env.CONTENT_TEAM_BANK_ALERT_EMAILS;
    if (!raw?.trim()) {
      return [];
    }

    const seen = new Set<string>();
    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => {
        if (entry.length === 0 || seen.has(entry)) return false;
        seen.add(entry);
        return true;
      });
  }
}
