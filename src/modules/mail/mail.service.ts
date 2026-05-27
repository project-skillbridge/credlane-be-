import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { env } from '../../config/env';
import { loadMailTemplateFile, substituteMailTemplate } from './mail-templates';
import type {
  AdvancedRetakeAvailableEmailPayload,
  AssessmentPerformanceEmailPayload,
  JobReadyMatchesDigestEmailPayload,
  PasswordResetEmailPayload,
  SendMailOptions,
} from './mail.types';
import { OutboundEmailQueueService } from './outbound-email-queue.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly client = new Resend(env.RESEND_API_KEY);

  constructor(private readonly outboundEmailQueue: OutboundEmailQueueService) {}

  async send({ to, subject, html, text, from }: SendMailOptions) {
    if (!html && !text) {
      throw new Error('Sending a mail requires either `html` or `text`.');
    }

    const basePayload = {
      from: from ?? env.RESEND_MAIL_FROM,
      to,
      subject,
    };

    const payload: Parameters<Resend['emails']['send']>[0] = html
      ? { ...basePayload, html, ...(text ? { text } : {}) }
      : { ...basePayload, text: text! };

    const { data, error } = await this.client.emails.send(payload);

    if (error) {
      this.logger.error(
        `Failed to send email to ${String(to)}: ${error.message}`,
      );
      throw new Error(error.message);
    }

    return data;
  }

  /** Enqueues when REDIS_URL is set; otherwise sends immediately (still off the forgot-password await path when called from the password-reset worker). */
  async sendPasswordReset(params: PasswordResetEmailPayload): Promise<unknown> {
    return this.outboundEmailQueue.enqueuePasswordReset(params);
  }

  async sendVerificationOtp(params: {
    to: string;
    otp: string;
    expiresAt: Date;
    recipientFirstName: string;
  }) {
    const expiresInMinutes = Math.max(
      1,
      Math.ceil((params.expiresAt.getTime() - Date.now()) / (60 * 1000)),
    );
    const padded = params.otp.padStart(6, '0');
    const digits = padded.split('');
    const digitVars = Object.fromEntries(
      digits.map((d, i) => [`digit${i + 1}`, d]),
    ) as Record<string, string>;

    const base = env.FRONTEND_URL.replace(/\/$/, '');
    const logoUrl =
      env.EMAIL_LOGO_URL ??
      'https://placehold.co/140x40/1f5f6b/ffffff/png?text=SkillBridge';

    const vars: Record<string, string> = {
      name: params.recipientFirstName.trim() || 'there',
      verifyUrl: `${base}/verify-email`,
      logoUrl,
      playStoreUrl: '',
      appStoreUrl: '',
      playStoreLink: '#',
      appStoreLink: '#',
      supportEmail: env.SUPPORT_EMAIL,
      year: String(new Date().getFullYear()),
      expiresMinutes: String(expiresInMinutes),
      ...digitVars,
    };

    const rawHtml = loadMailTemplateFile('verify-code.html');
    const html = substituteMailTemplate(rawHtml, vars);
    const text =
      `Hi ${vars.name},\n\n` +
      `Use this code to verify your SkillBridge account: ${padded}.\n` +
      `It expires in ${expiresInMinutes} minute(s). If you did not create a SkillBridge account, you can ignore this email safely.\n`;

    return this.send({
      to: params.to,
      subject: 'Verify your SkillBridge email',
      text,
      html,
    });
  }

  async sendAssessmentPerformance(params: AssessmentPerformanceEmailPayload) {
    const base = env.FRONTEND_URL.replace(/\/$/, '');
    const logoUrl =
      env.EMAIL_LOGO_URL ??
      'https://placehold.co/140x40/1f5f6b/ffffff/png?text=SkillBridge';
    const dashboardUrl = `${base}/t/dashboard`;
    const name = params.recipientFirstName.trim() || 'there';

    const vars: Record<string, string> = {
      name,
      score: String(params.score),
      maxScore: String(params.maxScore),
      percentage: String(params.percentage),
      tierLabel: params.tierLabel,
      dashboardUrl,
      logoUrl,
      supportEmail: env.SUPPORT_EMAIL,
      year: String(new Date().getFullYear()),
    };

    const rawHtml = loadMailTemplateFile('assessment-performance.html');
    const html = substituteMailTemplate(rawHtml, vars);
    const text =
      `Hi ${name},\n\n` +
      `Your advanced assessment is complete. You scored ${vars.score}/${vars.maxScore} (${vars.percentage}%) — tier: ${vars.tierLabel}.\n\n` +
      `View your full results on your dashboard: ${dashboardUrl}\n`;

    return this.send({
      to: params.to,
      subject: 'Your SkillBridge assessment results are ready',
      text,
      html,
    });
  }

  async sendAdvancedRetakeAvailable(
    params: AdvancedRetakeAvailableEmailPayload,
  ) {
    const base = env.FRONTEND_URL.replace(/\/$/, '');
    const logoUrl =
      env.EMAIL_LOGO_URL ??
      'https://placehold.co/140x40/1f5f6b/ffffff/png?text=SkillBridge';
    const dashboardUrl = `${base}/t/dashboard`;
    const name = params.recipientFirstName.trim() || 'there';

    const vars: Record<string, string> = {
      name,
      dashboardUrl,
      logoUrl,
      supportEmail: env.SUPPORT_EMAIL,
      year: String(new Date().getFullYear()),
    };

    const rawHtml = loadMailTemplateFile('advanced-retake-available.html');
    const html = substituteMailTemplate(rawHtml, vars);
    const text =
      `Hi ${name},\n\n` +
      `Your 14-day advanced assessment waiting period has ended. You can retake the assessment now.\n\n` +
      `Go to your dashboard: ${dashboardUrl}\n`;

    return this.send({
      to: params.to,
      subject: 'You can retake your advanced assessment',
      text,
      html,
    });
  }

  async sendJobReadyMatchesDigest(params: JobReadyMatchesDigestEmailPayload) {
    const base = env.FRONTEND_URL.replace(/\/$/, '');
    const logoUrl =
      env.EMAIL_LOGO_URL ??
      'https://placehold.co/140x40/1f5f6b/ffffff/png?text=SkillBridge';
    const discoveryUrl = `${base}/employer/discovery/candidates`;
    const name = params.recipientFirstName.trim() || 'there';
    const label = params.matchCount === 1 ? 'candidate' : 'candidates';
    const verb = params.matchCount === 1 ? 'matches' : 'match';
    const summaryLine = `${params.matchCount} new Job Ready ${label} ${verb} your saved hiring preferences this week.`;

    const vars: Record<string, string> = {
      name,
      matchCount: String(params.matchCount),
      matchCountSuffix: params.matchCount === 1 ? '' : 'es',
      summaryLine,
      discoveryUrl,
      logoUrl,
      supportEmail: env.SUPPORT_EMAIL,
      unsubscribeUrl: `${base}/email-preferences`,
      year: String(new Date().getFullYear()),
    };

    const rawHtml = loadMailTemplateFile('job-ready-matches-digest.html');
    const html = substituteMailTemplate(rawHtml, vars);
    const text =
      `Hi ${name},\n\n` +
      `${summaryLine}\n\n` +
      `Browse matching candidates: ${discoveryUrl}\n`;

    return this.send({
      to: params.to,
      subject: 'New Job Ready candidates match your hiring preferences',
      text,
      html,
    });
  }
}
