import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '../../config/env';
import type { SendMailAttachment } from './mail.types';

export const EMAIL_LOGO_CID = 'skillbridge-logo';
export const EMAIL_LOGO_OBJECT_KEY = 'logo-with-text-white.svg';

export type EmailLogoAttachment = SendMailAttachment & {
  content: Buffer;
  contentId: string;
};

export type ResolvedEmailLogo = {
  logoUrl: string;
  attachment?: EmailLogoAttachment;
};

function resolveLogoFromBundled(
  objectKey: string,
  contentId: string,
): ResolvedEmailLogo | null {
  const bundledLogoPath = join(__dirname, 'assets', objectKey);
  if (!existsSync(bundledLogoPath)) {
    return null;
  }

  return {
    logoUrl: `cid:${contentId}`,
    attachment: {
      filename: objectKey,
      content: readFileSync(bundledLogoPath),
      contentId,
    },
  };
}

/** Logo for transactional emails — bundled white logo inline via CID (never expires). */
export function resolveEmailLogo(): ResolvedEmailLogo {
  const bundled = resolveLogoFromBundled(EMAIL_LOGO_OBJECT_KEY, EMAIL_LOGO_CID);
  if (bundled) {
    return bundled;
  }

  const overrideUrl = env.EMAIL_LOGO_WHITE_URL ?? env.EMAIL_LOGO_URL;
  if (overrideUrl) {
    return { logoUrl: overrideUrl };
  }

  throw new Error(
    `Missing bundled email logo at modules/mail/assets/${EMAIL_LOGO_OBJECT_KEY}`,
  );
}

export function withEmailLogoAttachment(
  attachments: SendMailAttachment[] | undefined,
  logo: ResolvedEmailLogo,
): SendMailAttachment[] | undefined {
  if (!logo.attachment) {
    return attachments;
  }

  return [logo.attachment, ...(attachments ?? [])];
}
