'use strict';

// The development outbox lets codes and links be read without a real inbox. It must never
// run in production, and production must still fail loudly when email isn't configured.
const fs = require('fs');
const os = require('os');
const path = require('path');

const devMail = require('../../utils/devMail');

const file = path.join(os.tmpdir(), `devmail-test-${process.pid}.log`);
afterEach(() => { try { fs.unlinkSync(file); } catch { /* none */ } });

test('records mail in development, with links and codes readable', () => {
  const ok = devMail.recordDevMail({
    to: 'a@northwind.test', subject: 'Your Oruinwan verification code',
    html: '<p>Your code is <strong>123456</strong></p><a href="http://localhost:3000/verify?t=abc">Verify</a>',
  }, { NODE_ENV: 'development', DEV_MAIL_FILE: file });
  expect(ok).toBe(true);
  const out = fs.readFileSync(file, 'utf8');
  expect(out).toContain('To:      a@northwind.test');
  expect(out).toContain('123456');
  expect(out).toContain('Verify (http://localhost:3000/verify?t=abc)');
});

test('never records in production or tests', () => {
  expect(devMail.recordDevMail({ to: 'a@x.io', subject: 's', text: '999999' }, { NODE_ENV: 'production', DEV_MAIL_FILE: file })).toBe(false);
  expect(devMail.recordDevMail({ to: 'a@x.io', subject: 's', text: '999999' }, { NODE_ENV: 'test', DEV_MAIL_FILE: file })).toBe(false);
  expect(fs.existsSync(file)).toBe(false);
  expect(devMail.consoleOnly({ NODE_ENV: 'production', DEV_MAIL: 'console' })).toBe(false);
  expect(devMail.consoleOnly({ NODE_ENV: 'development', DEV_MAIL: 'console' })).toBe(true);
});

describe('sendEmail without any provider', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    jest.resetModules();
    for (const k of Object.keys(process.env)) if (/^(BREVO|SMTP)/.test(k)) delete process.env[k];
    process.env.DEV_MAIL_FILE = file;
  });
  afterEach(() => { process.env = { ...saved }; });

  test('development: delivered to the outbox instead of failing', async () => {
    process.env.NODE_ENV = 'development';
    const sendEmail = require('../../utils/sendEmail');
    await expect(sendEmail({ to: 'a@northwind.test', subject: 'Hi', text: 'code 654321' })).resolves.toEqual({ provider: 'dev-outbox', id: null });
    expect(fs.readFileSync(file, 'utf8')).toContain('654321');
  });

  test('production: still throws, nothing is written', async () => {
    process.env.NODE_ENV = 'production';
    const sendEmail = require('../../utils/sendEmail');
    await expect(sendEmail({ to: 'a@x.io', subject: 'Hi', text: 'code 111111' })).rejects.toThrow(/not configured/);
    expect(fs.existsSync(file)).toBe(false);
  });
});
