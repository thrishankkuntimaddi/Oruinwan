'use strict';

// Company sign-up needs a code-verified email (and phone when SMS is on), checked on the server.
jest.mock('../../../shared/services/otp.service', () => ({ verifyOTP: jest.fn(() => ({ valid: true, error: null })) }));
jest.mock('../../../identity', () => ({}));
jest.mock('../../../shared/postgres', () => ({ query: jest.fn() }));

const otpProof = require('../../../shared/services/otpProof');
const { assertSignupContactsVerified } = require('../signupProof');

const SMS_ENV = { TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'token', TWILIO_PHONE_NUMBER: '+15550001111' };

beforeEach(() => {
  for (const k of Object.keys(SMS_ENV)) delete process.env[k];
});

test('refuses sign-up when the personal email was never verified', () => {
  expect(() => assertSignupContactsVerified({ personalEmail: 'owner@example.com', phone: '', phoneCode: '+91' }))
    .toThrow('Verify your personal email before registering');
});

test('accepts a verified email in a different letter case', () => {
  otpProof.markVerified('Owner@Example.com');
  expect(() => assertSignupContactsVerified({ personalEmail: 'owner@example.com', phone: '', phoneCode: '+91' })).not.toThrow();
});

test('refuses sign-up without a personal email at all', () => {
  expect(() => assertSignupContactsVerified({ phone: '', phoneCode: '+91' })).toThrow('Verify your personal email');
});

test('does not ask for a phone code when SMS is not configured', () => {
  otpProof.markVerified('hello@example.org');
  expect(() => assertSignupContactsVerified({ personalEmail: 'hello@example.org', phone: '9876543210', phoneCode: '+91' }))
    .not.toThrow();
});

test('requires a verified phone when SMS is configured, matching the code target format', () => {
  Object.assign(process.env, SMS_ENV);
  otpProof.markVerified('a@example.com');

  expect(() => assertSignupContactsVerified({ personalEmail: 'a@example.com', phone: '', phoneCode: '+91' }))
    .toThrow('Phone number is required');
  expect(() => assertSignupContactsVerified({ personalEmail: 'a@example.com', phone: '98765 43210', phoneCode: '+91' }))
    .toThrow('Verify your phone number before registering');

  // The page sends the code to "+91" + the number as typed (spaces and dashes included).
  otpProof.markVerified('+91 98765-43210');
  expect(() => assertSignupContactsVerified({ personalEmail: 'a@example.com', phone: '9876543210', phoneCode: '+91' }))
    .not.toThrow();
});

test('a successful code verification records the proof through the verify endpoint', async () => {
  const otpController = require('../../../shared/controllers/otp.controller');
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await otpController.verifyOtp({ body: { target: 'New.Owner@Example.com', otp: '123456' } }, res);

  expect(res.body.verified).toBe(true);
  expect(otpProof.isVerified('new.owner@example.com')).toBe(true);
});

test('proofs expire', () => {
  jest.useFakeTimers();
  try {
    otpProof.markVerified('late@example.com');
    jest.advanceTimersByTime(otpProof.PROOF_TTL_MS + 1000);
    expect(otpProof.isVerified('late@example.com')).toBe(false);
  } finally {
    jest.useRealTimers();
  }
});
