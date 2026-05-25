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
        unsubscribeUrl: 'https://example.com/email-preferences',
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
    expect(compactHtml).not.toContain('for your brand, for a cause, or just');
    expect(compactHtml).not.toContain('15 minutes');
  });
});
