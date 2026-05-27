import { loadMailTemplateFile, substituteMailTemplate } from './mail-templates';

describe('verification email template', () => {
  it('uses account-verification copy and dynamic expiry text', () => {
    const html = substituteMailTemplate(
      loadMailTemplateFile('verify-code.html'),
      {
        name: 'Jane',
        digit1: '1',
        digit2: '2',
        digit3: '3',
        digit4: '4',
        digit5: '5',
        digit6: '6',
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
    expect(compactHtml).toContain('https://example.com/employer/discovery/candidates');
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
    expect(compactHtml).toContain('https://example.com/employer/discovery/candidates');
  });
});
