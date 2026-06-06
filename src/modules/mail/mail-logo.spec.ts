import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Mocked env — values are overridden per-test for fallback branches
jest.mock('../../config/env', () => ({
  env: { EMAIL_LOGO_WHITE_URL: undefined, EMAIL_LOGO_URL: undefined },
}));

import { env } from '../../config/env';
import {
  EMAIL_LOGO_CID,
  EMAIL_LOGO_OBJECT_KEY,
  _resetEmailLogoCache,
  resolveEmailLogo,
  withEmailLogoAttachment,
} from './mail-logo';

// Convenience cast so tests can assign values without TS errors
const mockEnv = env as unknown as {
  EMAIL_LOGO_WHITE_URL: string | undefined;
  EMAIL_LOGO_URL: string | undefined;
};

describe('resolveEmailLogo — bundled asset present', () => {
  const bundledLogoPath = join(__dirname, 'assets', EMAIL_LOGO_OBJECT_KEY);

  afterEach(() => {
    _resetEmailLogoCache();
  });

  it('uses bundled inline white logo', () => {
    expect(existsSync(bundledLogoPath)).toBe(true);

    const logo = resolveEmailLogo();

    expect(logo.logoUrl).toBe(`cid:${EMAIL_LOGO_CID}`);
    expect(logo.attachment?.contentId).toBe(EMAIL_LOGO_CID);
    expect(logo.attachment?.filename).toBe(EMAIL_LOGO_OBJECT_KEY);
    expect(logo.attachment?.content.length).toBeGreaterThan(0);
  });

  it('returns the same memoized object on subsequent calls', () => {
    const first = resolveEmailLogo();
    const second = resolveEmailLogo();

    expect(second).toBe(first);
  });
});

describe('resolveEmailLogo — bundled asset missing', () => {
  let existsSyncSpy: jest.SpyInstance;

  beforeEach(() => {
    existsSyncSpy = jest
      .spyOn(require('node:fs'), 'existsSync')
      .mockReturnValue(false);
    _resetEmailLogoCache();
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
    mockEnv.EMAIL_LOGO_WHITE_URL = undefined;
    mockEnv.EMAIL_LOGO_URL = undefined;
    _resetEmailLogoCache();
  });

  it('falls back to EMAIL_LOGO_WHITE_URL and returns no attachment', () => {
    mockEnv.EMAIL_LOGO_WHITE_URL = 'https://cdn.example.com/logo-white.png';

    const logo = resolveEmailLogo();

    expect(logo.logoUrl).toBe('https://cdn.example.com/logo-white.png');
    expect(logo.attachment).toBeUndefined();
  });

  it('falls back to EMAIL_LOGO_URL when WHITE_URL is unset, returns no attachment', () => {
    mockEnv.EMAIL_LOGO_URL = 'https://cdn.example.com/logo.png';

    const logo = resolveEmailLogo();

    expect(logo.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect(logo.attachment).toBeUndefined();
  });

  it('prefers EMAIL_LOGO_WHITE_URL over EMAIL_LOGO_URL', () => {
    mockEnv.EMAIL_LOGO_WHITE_URL = 'https://cdn.example.com/logo-white.png';
    mockEnv.EMAIL_LOGO_URL = 'https://cdn.example.com/logo.png';

    const logo = resolveEmailLogo();

    expect(logo.logoUrl).toBe('https://cdn.example.com/logo-white.png');
  });

  it('throws when bundled asset is missing and no override env vars are set', () => {
    expect(() => resolveEmailLogo()).toThrow(
      `Missing bundled email logo at modules/mail/assets/${EMAIL_LOGO_OBJECT_KEY}`,
    );
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

  it('returns original attachments unchanged when logo has no attachment', () => {
    const attachments = [{ filename: 'export.json', content: '{}' }];
    const merged = withEmailLogoAttachment(attachments, {
      logoUrl: 'https://cdn.example.com/logo.png',
    });

    expect(merged).toBe(attachments);
  });
});
