'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mediaKinds, accessAction, settingsUrl, blockedMessage } = require('../permissions');
const { inAppPath, navigateScript } = require('../links');

test('media requests map to the OS kinds; no types means the microphone', () => {
  assert.deepEqual(mediaKinds({ mediaTypes: ['audio'] }), ['microphone']);
  assert.deepEqual(mediaKinds({ mediaTypes: ['audio', 'video'] }), ['microphone', 'camera']);
  assert.deepEqual(mediaKinds({ mediaTypes: ['video'] }), ['camera']);
  assert.deepEqual(mediaKinds({}), ['microphone']);
  assert.deepEqual(mediaKinds(undefined), ['microphone']);
});

test('macOS asks the first time; refused access is blocked; unknown lets Chromium try', () => {
  assert.equal(accessAction('granted', 'darwin'), 'allow');
  assert.equal(accessAction('not-determined', 'darwin'), 'ask');
  assert.equal(accessAction('not-determined', 'win32'), 'allow');
  assert.equal(accessAction('denied', 'darwin'), 'blocked');
  assert.equal(accessAction('restricted', 'win32'), 'blocked');
  assert.equal(accessAction('unknown', 'linux'), 'allow');
});

test('settings pages for each platform', () => {
  assert.equal(settingsUrl('microphone', 'darwin'), 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
  assert.equal(settingsUrl('screen', 'darwin'), 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
  assert.equal(settingsUrl('camera', 'win32'), 'ms-settings:privacy-webcam');
  assert.equal(settingsUrl('screen', 'win32'), null);
  assert.equal(settingsUrl('microphone', 'linux'), null);
  assert.match(blockedMessage('camera', 'darwin').detail, /Privacy & Security → Camera/);
  assert.match(blockedMessage('screen', 'darwin').detail, /quit and reopen/);
});

test('app pages stay in the app; other addresses do not', () => {
  const origin = 'app://oruinwan';
  assert.equal(inAppPath('app://oruinwan/workspace/w1/meetings/m1?tab=notes#x', origin), '/workspace/w1/meetings/m1?tab=notes#x');
  assert.equal(inAppPath('app://oruinwan', origin), '/');
  assert.equal(inAppPath('https://example.com/workspace/w1', origin), null);
  assert.equal(inAppPath('app://evil/workspace', origin), null);
  assert.equal(inAppPath('about:blank', origin), null);
  assert.equal(inAppPath('not a url', origin), null);
  assert.equal(inAppPath('http://localhost:3000/tasks', 'http://localhost:3000'), '/tasks');
});

test('the navigate script embeds the path as data, not code', () => {
  const script = navigateScript('/a"); alert(1); ("');
  assert.ok(script.includes(JSON.stringify('/a"); alert(1); ("')));
  assert.ok(script.includes('history.pushState'));
});
