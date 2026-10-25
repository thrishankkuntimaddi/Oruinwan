'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { pathFromAppLink, appLinkInArgs, inAppPath } = require('../links');

test('an email button opened on the desktop lands on the same page in the app', () => {
  assert.strictEqual(pathFromAppLink('oruinwan://open/settings/security'), '/settings/security');
  assert.strictEqual(pathFromAppLink('oruinwan://open/workspace/abc/tasks/t1?x=1#y'), '/workspace/abc/tasks/t1?x=1#y');
  assert.strictEqual(pathFromAppLink('oruinwan://open'), '/');
  assert.strictEqual(pathFromAppLink('oruinwan://open/'), '/');
});

test('anything else is not an app link', () => {
  assert.strictEqual(pathFromAppLink('oruinwan://sso?code=1'), null);
  assert.strictEqual(pathFromAppLink('https://oruinwan.poelys.com/open/x'), null);
  assert.strictEqual(pathFromAppLink('oruinwan://open//evil.example.com'), null);
  assert.strictEqual(pathFromAppLink('not a url'), null);
  assert.strictEqual(pathFromAppLink(undefined), null);
});

test('Windows and Linux hand the link over as a command-line argument', () => {
  assert.strictEqual(appLinkInArgs(['/opt/Oruinwan/oruinwan', '--no-sandbox', 'oruinwan://open/notifications']), 'oruinwan://open/notifications');
  assert.strictEqual(appLinkInArgs(['/opt/Oruinwan/oruinwan']), null);
});

test('in-app paths still only come from the app itself', () => {
  assert.strictEqual(inAppPath('app://oruinwan/workspace/1', 'app://oruinwan'), '/workspace/1');
  assert.strictEqual(inAppPath('https://evil.example.com/', 'app://oruinwan'), null);
});
