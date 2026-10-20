'use strict';

const { webAppUrl, webAppUrlProblem } = require('../webAppUrl');

test('emailed links start with the public web app address, without a trailing slash', () => {
  expect(webAppUrl({ FRONTEND_URL: 'https://oruinwan.poelys.com/' })).toBe('https://oruinwan.poelys.com');
});

test('a development server falls back to the local web app', () => {
  expect(webAppUrl({})).toBe('http://localhost:3000');
});

test('a production address must be public https', () => {
  expect(webAppUrlProblem({ FRONTEND_URL: 'https://oruinwan.poelys.com' })).toBeNull();
  expect(webAppUrlProblem({})).toMatch(/not set/);
  expect(webAppUrlProblem({ FRONTEND_URL: 'http://localhost:3000' })).toMatch(/this machine/);
  expect(webAppUrlProblem({ FRONTEND_URL: 'http://127.0.0.1:8080' })).toMatch(/this machine/);
  expect(webAppUrlProblem({ FRONTEND_URL: 'http://oruinwan.poelys.com' })).toMatch(/https/);
  expect(webAppUrlProblem({ FRONTEND_URL: 'not a url' })).toMatch(/not an address/);
});
