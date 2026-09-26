'use strict';

const { parseFrom, resolveSender, diagnoseEmailConfig } = require('../../utils/emailConfig');

describe('parseFrom', () => {
  test('bare address uses the fallback name', () => {
    expect(parseFrom('noreply@chttrix.com')).toEqual({ name: 'Chttrix', email: 'noreply@chttrix.com' });
  });
  test('"Name <addr>" form (the production template format)', () => {
    expect(parseFrom('Chttrix <noreply@yourdomain.com>')).toEqual({ name: 'Chttrix', email: 'noreply@yourdomain.com' });
  });
  test('quoted name and extra spaces', () => {
    expect(parseFrom('  "Chttrix Team"   <  hi@x.io > ')).toEqual({ name: 'Chttrix Team', email: 'hi@x.io' });
  });
  test('empty name inside angle form falls back', () => {
    expect(parseFrom('<hi@x.io>', 'Fallback')).toEqual({ name: 'Fallback', email: 'hi@x.io' });
  });
  test('invalid values return null', () => {
    expect(parseFrom('')).toBeNull();
    expect(parseFrom('not an email')).toBeNull();
    expect(parseFrom('Chttrix <broken>')).toBeNull();
  });
});

describe('resolveSender', () => {
  test('EMAIL_FROM wins, EMAIL_FROM_NAME overrides the default name', () => {
    expect(resolveSender({ EMAIL_FROM: 'a@b.com', EMAIL_FROM_NAME: 'Acme', SMTP_USER: 'x@y.com' }))
      .toEqual({ name: 'Acme', email: 'a@b.com' });
  });
  test('falls back to SMTP_USER when EMAIL_FROM is missing or invalid', () => {
    expect(resolveSender({ EMAIL_FROM: 'junk', SMTP_USER: 'x@y.com' }).email).toBe('x@y.com');
  });
});

describe('diagnoseEmailConfig', () => {
  const good = {
    BREVO_API_KEY: 'xkeysib-abc',
    EMAIL_FROM: 'noreply@chttrix.com',
  };
  const levels = (env) => diagnoseEmailConfig(env).map((i) => i.level);
  const text = (env) => diagnoseEmailConfig(env).map((i) => i.message).join('\n');

  test('a Brevo key and own-domain sender has no issues', () => {
    expect(diagnoseEmailConfig(good)).toEqual([]);
  });
  test('no provider at all is an error', () => {
    expect(levels({})).toEqual(['error']);
  });
  test('a gmail.com sender is flagged as a DMARC error', () => {
    const env = { ...good, EMAIL_FROM: 'someone@gmail.com' };
    expect(levels(env)).toContain('error');
    expect(text(env)).toMatch(/gmail\.com.*DMARC/);
  });
  test('Brevo SMTP with a non-SMTP-key password is flagged', () => {
    const env = { ...good, SMTP_HOST: 'smtp-relay.brevo.com', SMTP_USER: 'u@smtp-brevo.com', SMTP_PASS: 'hunter2' };
    expect(text(env)).toMatch(/xsmtpsib-/);
  });
  test('a proper Brevo SMTP key passes', () => {
    const env = { ...good, SMTP_HOST: 'smtp-relay.brevo.com', SMTP_USER: 'u@smtp-brevo.com', SMTP_PASS: 'xsmtpsib-123' };
    expect(diagnoseEmailConfig(env)).toEqual([]);
  });
  test('a malformed API key and EMAIL_FROM are errors', () => {
    const env = { BREVO_API_KEY: 'abc', EMAIL_FROM: 'Chttrix <nope>' };
    const msgs = text(env);
    expect(msgs).toMatch(/xkeysib-/);
    expect(msgs).toMatch(/EMAIL_FROM is not a valid address/);
  });
  test('messages never contain the secret values', () => {
    const env = { BREVO_API_KEY: 'SECRETKEY', SMTP_HOST: 'smtp-relay.brevo.com', SMTP_USER: 'u@smtp-brevo.com', SMTP_PASS: 'SECRETPASS', EMAIL_FROM: 'a@gmail.com' };
    expect(text(env)).not.toMatch(/SECRETKEY|SECRETPASS/);
  });
});

describe('sendEmail sender wiring', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; jest.resetModules(); });

  test('Brevo payload uses the parsed "Name <addr>" sender', async () => {
    process.env = { ...saved, BREVO_API_KEY: 'xkeysib-test', EMAIL_FROM: 'Chttrix Team <noreply@chttrix.com>' };
    delete process.env.SMTP_HOST; delete process.env.SMTP_FALLBACK_HOST;
    jest.doMock('axios', () => ({ post: jest.fn().mockResolvedValue({ data: { messageId: 'm1' } }) }));
    const axios = require('axios');
    const sendEmail = require('../../utils/sendEmail');
    const out = await sendEmail({ to: 'x@y.com', subject: 's', text: 't' });
    expect(out).toEqual({ provider: 'brevo', id: 'm1' });
    expect(axios.post.mock.calls[0][1].sender).toEqual({ name: 'Chttrix Team', email: 'noreply@chttrix.com' });
  });
});
