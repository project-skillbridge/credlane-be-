import { loadMailTemplateFile, substituteMailTemplate } from './mail-templates';

describe('verification email template', () => {
  it('uses account-verification copy and dynamic expiry text', () => {
    const html = substituteMailTemplate(
      loadMailTemplateFile('verify-code.html'),
      {
        name: 'Jane',
        code: '123456',
        verifyUrl: 'https://example.com/verify-email',
        logoUrl: 'https://example.com/logo.png',
        playStoreUrl: '',
        appStoreUrl: '',
        playStoreLink: '#',
        appStoreLink: '#',
        supportEmail: 'support@example.com',
        year: '2026',
        expiresMinutes: '9',
      },
    );

    const compactHtml = html.replace(/\s+/g, ' ');

    expect(compactHtml).toContain('Verify your SkillBridge account');
    expect(compactHtml).toContain(
      'Use this code to verify your SkillBridge account',
    );
    expect(compactHtml).toContain('valid for 9 minutes');
    expect(compactHtml).toContain(
      'If you did not create a SkillBridge account',
    );
    expect(compactHtml).not.toContain('unsubscribe');
    expect(compactHtml).not.toContain('for your brand, for a cause, or just');
    expect(compactHtml).not.toContain('15 minutes');
  });
});

describe('job ready matches digest email template', () => {
  it('renders employer weekly digest copy and discovery CTA', () => {
    const html = substituteMailTemplate(
      loadMailTemplateFile('job-ready-matches-digest.html'),
      {
        name: 'Jane',
        matchCount: '2',
        matchCountSuffix: 'es',
        summaryLine:
          '2 new Job Ready candidates match your saved hiring preferences this week.',
        discoveryUrl: 'https://example.com/employer/discovery/candidates',
        logoUrl: 'https://example.com/logo.png',
        supportEmail: 'support@example.com',
        unsubscribeUrl: 'https://example.com/email-preferences',
        year: '2026',
      },
    );

    const compactHtml = html.replace(/\s+/g, ' ');

    expect(compactHtml).toContain(
      'New Job Ready candidates match your preferences',
    );
    expect(compactHtml).toContain('View matching candidates');
    expect(compactHtml).toContain(
      '2 new Job Ready candidates match your saved hiring preferences this week.',
    );
    expect(compactHtml).toContain(
      'https://example.com/employer/discovery/candidates',
    );
  });

  it('renders singular form for one match', () => {
    const html = substituteMailTemplate(
      loadMailTemplateFile('job-ready-matches-digest.html'),
      {
        name: 'Jane',
        matchCount: '1',
        matchCountSuffix: '',
        summaryLine:
          '1 new Job Ready candidate matches your saved hiring preferences this week.',
        discoveryUrl: 'https://example.com/employer/discovery/candidates',
        logoUrl: 'https://example.com/logo.png',
        supportEmail: 'support@example.com',
        unsubscribeUrl: 'https://example.com/email-preferences',
        year: '2026',
      },
    );

    const compactHtml = html.replace(/\s+/g, ' ');

    expect(compactHtml).toContain(
      'New Job Ready candidates match your preferences',
    );
    expect(compactHtml).toContain('View matching candidates');
    expect(compactHtml).toContain(
      '1 new Job Ready candidate matches your saved hiring preferences this week.',
    );
    expect(compactHtml).toContain(
      'new Job Ready match for your hiring preferences',
    );
    expect(compactHtml).not.toContain('new Job Ready matches for your hiring');
    expect(compactHtml).toContain(
      'https://example.com/employer/discovery/candidates',
    );
  });
});

describe('assessment performance email template', () => {
  it('renders results copy without an unsubscribe link', () => {
    const html = substituteMailTemplate(
      loadMailTemplateFile('assessment-performance.html'),
      {
        name: 'Jane',
        score: '78',
        maxScore: '100',
        percentage: '78',
        tierLabel: 'Job Ready',
        dashboardUrl: 'https://example.com/t/dashboard',
        logoUrl: 'https://example.com/logo.png',
        supportEmail: 'support@example.com',
        year: '2026',
      },
    );

    const compactHtml = html.replace(/\s+/g, ' ');

    expect(compactHtml).toContain('Your assessment results are ready');
    expect(compactHtml).toContain('78%');
    expect(compactHtml).toContain('support@example.com');
    expect(compactHtml).toContain('background-color: #1f5f6b');
    expect(compactHtml).toContain('https://example.com/logo.png');
    expect(compactHtml).not.toContain('unsubscribe');
    expect(compactHtml).not.toContain('Email preferences');
  });
});

describe('advanced retake email template', () => {
  it('renders the retake notice without an unsubscribe link', () => {
    const html = substituteMailTemplate(
      loadMailTemplateFile('advanced-retake-available.html'),
      {
        name: 'Jane',
        dashboardUrl: 'https://example.com/t/dashboard',
        logoUrl: 'https://example.com/logo.png',
        supportEmail: 'support@example.com',
        year: '2026',
      },
    );

    const compactHtml = html.replace(/\s+/g, ' ');

    expect(compactHtml).toContain('You can retake your advanced assessment');
    expect(compactHtml).toContain('Go to dashboard');
    expect(compactHtml).toContain('support@example.com');
    expect(compactHtml).not.toContain('unsubscribe');
    expect(compactHtml).not.toContain('Email preferences');
  });
});

describe('data export email template', () => {
  it('renders export copy and logo image src', () => {
    const html = substituteMailTemplate(
      loadMailTemplateFile('data-export.html'),
      {
        name: 'Jane',
        fileName: 'skillbridge-data-export-jane-doe-2026-06-05.json',
        logoUrl: 'cid:skillbridge-logo',
        contactUrl: 'https://example.com/contact',
        unsubscribeUrl: 'https://example.com/email-preferences',
        year: '2026',
      },
    );

    const compactHtml = html.replace(/\s+/g, ' ');

    expect(compactHtml).toContain('Your data export is ready');
    expect(compactHtml).toContain('src="cid:skillbridge-logo"');
    expect(compactHtml).toContain(
      'skillbridge-data-export-jane-doe-2026-06-05.json',
    );
  });
});

describe('password reset email template', () => {
  it('renders OTP digits and logo image src', () => {
    const html = substituteMailTemplate(
      loadMailTemplateFile('password-reset.html'),
      {
        name: 'Jane',
        code: '123456',
        expiresMinutes: '15',
        logoUrl: 'cid:skillbridge-logo',
        supportEmail: 'support@example.com',
        year: '2026',
      },
    );

    const compactHtml = html.replace(/\s+/g, ' ');

    expect(compactHtml).toContain('Reset your password');
    expect(compactHtml).toContain('src="cid:skillbridge-logo"');
    expect(compactHtml).toContain('123456');
  });
});
