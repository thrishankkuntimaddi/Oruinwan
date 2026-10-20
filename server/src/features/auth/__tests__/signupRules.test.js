'use strict';

const { checkDob, checkUsername, ageOn } = require('../signupRules');

const today = new Date('2026-10-20T12:00:00Z');

test('age counts a birthday not yet reached this year as one less', () => {
  expect(ageOn(new Date('2013-10-21'), today)).toBe(12);
  expect(ageOn(new Date('2013-10-20'), today)).toBe(13);
});

test('date of birth is required, real, in the past and at least 13 years ago', () => {
  expect(checkDob('', today).error).toMatch(/required/);
  expect(checkDob('not a date', today).error).toMatch(/Invalid/);
  expect(checkDob('2030-01-01', today).error).toMatch(/future/);
  expect(checkDob('2014-01-01', today).error).toMatch(/13/);
  expect(checkDob('1990-05-01', today).dob).toBeInstanceOf(Date);
});

test('usernames are trimmed and between 2 and 40 characters', () => {
  expect(checkUsername('  Ada   Lovelace ').username).toBe('Ada Lovelace');
  expect(checkUsername('a').error).toBeTruthy();
  expect(checkUsername('x'.repeat(41)).error).toBeTruthy();
});
