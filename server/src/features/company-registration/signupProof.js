'use strict';

const { isVerified, smsConfigured } = require('../../shared/services/otpProof');

// Company sign-up must not rely on the web page: the server checks that the personal email
// (and the phone, when SMS is configured) were verified with a code shortly before.
// The phone is checked as phoneCode + number, the same value the code was sent to.
function assertSignupContactsVerified({ personalEmail, phone, phoneCode }) {
  if (!personalEmail || !isVerified(personalEmail)) {
    throw new Error('Verify your personal email before registering');
  }
  if (smsConfigured()) {
    if (!phone) throw new Error('Phone number is required');
    if (!isVerified(`${phoneCode || '+91'}${phone}`)) {
      throw new Error('Verify your phone number before registering');
    }
  }
}

module.exports = { assertSignupContactsVerified };
