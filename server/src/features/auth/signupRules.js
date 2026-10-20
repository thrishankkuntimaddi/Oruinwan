'use strict';

// Rules every new account follows, whether it signs up with a password or with Google.

const MIN_AGE = 13;

/** Whole years between dob and today (birthday not reached yet this year counts as one less). */
function ageOn(dob, today = new Date()) {
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

/**
 * Checks a date of birth ("YYYY-MM-DD" or anything Date understands).
 * Returns { dob } or { error } with a message for the person.
 */
function checkDob(value, today = new Date()) {
  if (value === undefined || value === null || value === '') return { error: 'Date of birth is required' };
  const dob = new Date(value);
  if (Number.isNaN(dob.getTime())) return { error: 'Invalid date of birth' };
  if (dob > today) return { error: 'Date of birth cannot be in the future' };
  if (dob.getFullYear() < 1900) return { error: 'Invalid date of birth' };
  if (ageOn(dob, today) < MIN_AGE) return { error: `You must be at least ${MIN_AGE} years old` };
  return { dob };
}

/** Trims a display username and checks its length. Returns { username } or { error }. */
function checkUsername(value) {
  const username = String(value || '').trim().replace(/\s+/g, ' ');
  if (username.length < 2) return { error: 'Username must be at least 2 characters' };
  if (username.length > 40) return { error: 'Username must be at most 40 characters' };
  return { username };
}

module.exports = { checkDob, checkUsername, ageOn, MIN_AGE };
