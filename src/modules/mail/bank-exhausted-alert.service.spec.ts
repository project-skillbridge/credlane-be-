import { BankExhaustedAlertService } from './bank-exhausted-alert.service';
import { MailService } from './mail.service';

jest.mock('../../config/env', () => ({
  env: {
    CONTENT_TEAM_BANK_ALERT_EMAILS: '',
  },
}));

import { env as envUntyped } from '../../config/env';
const env = envUntyped as { CONTENT_TEAM_BANK_ALERT_EMAILS: string };

describe('BankExhaustedAlertService', () => {
  let service: BankExhaustedAlertService;
  let mailService: { sendBankExhaustedAlert: jest.Mock };

  beforeEach(() => {
    env.CONTENT_TEAM_BANK_ALERT_EMAILS = '';
    mailService = {
      sendBankExhaustedAlert: jest.fn().mockResolvedValue(undefined),
    };
    service = new BankExhaustedAlertService(
      mailService as unknown as MailService,
    );
  });

  describe('resolveRecipients', () => {
    it('returns empty array when env is unset', () => {
      expect(service.resolveRecipients()).toEqual([]);
    });

    it('parses comma-separated emails and trims whitespace', () => {
      env.CONTENT_TEAM_BANK_ALERT_EMAILS =
        ' content@example.com , ops@example.com ';

      expect(service.resolveRecipients()).toEqual([
        'content@example.com',
        'ops@example.com',
      ]);
    });
  });

  describe('notify', () => {
    it('does not send when no recipients are configured', () => {
      service.notify({
        assessmentType: 'skill',
        detail: 'Primary bank mix insufficient',
      });

      expect(mailService.sendBankExhaustedAlert).not.toHaveBeenCalled();
    });

    it('sends alert to configured recipients', async () => {
      env.CONTENT_TEAM_BANK_ALERT_EMAILS = 'content@example.com';

      service.notify({
        assessmentType: 'advanced',
        detail: 'Expected 19 questions but assembled 10',
        talentProfileId: 'profile-1',
        track: 'frontend_developer',
        expectedQuestions: 19,
        gotQuestions: 10,
      });

      await Promise.resolve();

      expect(mailService.sendBankExhaustedAlert).toHaveBeenCalledWith({
        assessmentType: 'advanced',
        detail: 'Expected 19 questions but assembled 10',
        talentProfileId: 'profile-1',
        track: 'frontend_developer',
        expectedQuestions: 19,
        gotQuestions: 10,
        to: ['content@example.com'],
      });
    });
  });
});
