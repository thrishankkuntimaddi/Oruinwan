'use strict';

const { webAppUrl, webAppUrlProblem, appOpenLink } = require('../webAppUrl');

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

test('email buttons go through /open so the app opens them when installed', () => {
  const env = { FRONTEND_URL: 'https://oruinwan.poelys.com' };
  expect(appOpenLink('https://oruinwan.poelys.com', env)).toBe('https://oruinwan.poelys.com/open/');
  expect(appOpenLink('https://oruinwan.poelys.com/settings/security', env)).toBe('https://oruinwan.poelys.com/open/settings/security');
  expect(appOpenLink('https://oruinwan.poelys.com/workspace/w1/tasks/t1?x=1', env)).toBe('https://oruinwan.poelys.com/open/workspace/w1/tasks/t1?x=1');
  expect(appOpenLink('https://oruinwan.poelys.com/join-workspace?token=abc', env)).toBe('https://oruinwan.poelys.com/open/join-workspace?token=abc');
});

test('one-time account links and other sites stay as they are', () => {
  const env = { FRONTEND_URL: 'https://oruinwan.poelys.com' };
  for (const url of [
    'https://oruinwan.poelys.com/verify-email?token=t',
    'https://oruinwan.poelys.com/reset-password?token=t',
    'https://oruinwan.poelys.com/accept-invite?token=t',
    'https://oruinwan.poelys.com/open/notifications',
    'https://oruinwan.poelys.com.evil.example/x',
    'https://example.com/x',
  ]) expect(appOpenLink(url, env)).toBe(url);
});
