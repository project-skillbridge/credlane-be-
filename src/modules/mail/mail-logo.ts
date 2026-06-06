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

let _cachedLogo: ResolvedEmailLogo | undefined;

/**
 * Logo for transactional emails — bundled white logo inline via CID (never expires).
 * Result is memoized after the first call to avoid repeated filesystem I/O.
 */
export function resolveEmailLogo(): ResolvedEmailLogo {
  if (_cachedLogo) {
    return _cachedLogo;
  }

  const bundled = resolveLogoFromBundled(EMAIL_LOGO_OBJECT_KEY, EMAIL_LOGO_CID);
  if (bundled) {
    _cachedLogo = bundled;
    return _cachedLogo;
  }

  const overrideUrl = env.EMAIL_LOGO_WHITE_URL ?? env.EMAIL_LOGO_URL;
  if (overrideUrl) {
    _cachedLogo = { logoUrl: overrideUrl };
    return _cachedLogo;
  }

  throw new Error(
    `Missing bundled email logo at modules/mail/assets/${EMAIL_LOGO_OBJECT_KEY}`,
  );
}

/** For use in tests only — clears the memoized logo so the next call re-resolves. */
export function _resetEmailLogoCache(): void {
  _cachedLogo = undefined;
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
