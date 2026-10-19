'use strict';

// Company sign-up needs a code-verified email (and phone when SMS is on), checked on the server.
jest.mock('../../../shared/services/otp.service', () => ({ verifyOTP: jest.fn(async () => ({ valid: true, error: null })) }));
jest.mock('../../../identity', () => ({}));
jest.mock('../../../shared/postgres', () => ({ query: jest.fn() }));

const otpProof = require('../../../shared/services/otpProof');
const { assertSignupContactsVerified } = require('../signupProof');

const SMS_ENV = { TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'token', TWILIO_PHONE_NUMBER: '+15550001111' };

beforeEach(() => {
  for (const k of Object.keys(SMS_ENV)) delete process.env[k];
});

test('refuses sign-up when the personal email was never verified', async () => {
  await expect(assertSignupContactsVerified({ personalEmail: 'owner@example.com', phone: '', phoneCode: '+91' }))
    .rejects.toThrow('Verify your personal email before registering');
});

test('accepts a verified email in a different letter case', async () => {
  await otpProof.markVerified('Owner@Example.com');
  await expect(assertSignupContactsVerified({ personalEmail: 'owner@example.com', phone: '', phoneCode: '+91' }))
    .resolves.toBeUndefined();
});

test('refuses sign-up without a personal email at all', async () => {
  await expect(assertSignupContactsVerified({ phone: '', phoneCode: '+91' })).rejects.toThrow('Verify your personal email');
});

test('does not ask for a phone code when SMS is not configured', async () => {
  await otpProof.markVerified('hello@example.org');
  await expect(assertSignupContactsVerified({ personalEmail: 'hello@example.org', phone: '9876543210', phoneCode: '+91' }))
    .resolves.toBeUndefined();
});

test('requires a verified phone when SMS is configured, matching the code target format', async () => {
  Object.assign(process.env, SMS_ENV);
  await otpProof.markVerified('a@example.com');

  await expect(assertSignupContactsVerified({ personalEmail: 'a@example.com', phone: '', phoneCode: '+91' }))
    .rejects.toThrow('Phone number is required');
  await expect(assertSignupContactsVerified({ personalEmail: 'a@example.com', phone: '98765 43210', phoneCode: '+91' }))
    .rejects.toThrow('Verify your phone number before registering');

  // The page sends the code to "+91" + the number as typed (spaces and dashes included).
  await otpProof.markVerified('+91 98765-43210');
  await expect(assertSignupContactsVerified({ personalEmail: 'a@example.com', phone: '9876543210', phoneCode: '+91' }))
    .resolves.toBeUndefined();
});

test('a successful code verification records the proof through the verify endpoint', async () => {
  const otpController = require('../../../shared/controllers/otp.controller');
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await otpController.verifyOtp({ body: { target: 'New.Owner@Example.com', otp: '123456' } }, res);

  expect(res.body.verified).toBe(true);
  expect(await otpProof.isVerified('new.owner@example.com')).toBe(true);
});

test('proofs expire', async () => {
  jest.useFakeTimers();
  try {
    await otpProof.markVerified('late@example.com');
    jest.advanceTimersByTime(otpProof.PROOF_TTL_MS + 1000);
    expect(await otpProof.isVerified('late@example.com')).toBe(false);
  } finally {
    jest.useRealTimers();
  }
});
