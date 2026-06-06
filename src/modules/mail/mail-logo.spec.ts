import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  EMAIL_LOGO_CID,
  EMAIL_LOGO_OBJECT_KEY,
  resolveEmailLogo,
  withEmailLogoAttachment,
} from './mail-logo';

describe('resolveEmailLogo', () => {
  const bundledLogoPath = join(__dirname, 'assets', EMAIL_LOGO_OBJECT_KEY);

  it('uses bundled inline white logo', () => {
    expect(existsSync(bundledLogoPath)).toBe(true);

    const logo = resolveEmailLogo();

    expect(logo.logoUrl).toBe(`cid:${EMAIL_LOGO_CID}`);
    expect(logo.attachment?.contentId).toBe(EMAIL_LOGO_CID);
    expect(logo.attachment?.filename).toBe(EMAIL_LOGO_OBJECT_KEY);
    expect(logo.attachment?.content.length).toBeGreaterThan(0);
  });
});

describe('withEmailLogoAttachment', () => {
  it('prepends logo attachment before other attachments', () => {
    const merged = withEmailLogoAttachment(
      [{ filename: 'export.json', content: '{}' }],
      {
        logoUrl: `cid:${EMAIL_LOGO_CID}`,
        attachment: {
          filename: EMAIL_LOGO_OBJECT_KEY,
          content: Buffer.from('<svg></svg>'),
          contentId: EMAIL_LOGO_CID,
        },
      },
    );

    expect(merged).toHaveLength(2);
    expect(merged?.[0].contentId).toBe(EMAIL_LOGO_CID);
    expect(merged?.[1].filename).toBe('export.json');
  });
});
