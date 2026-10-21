'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const s = require('../trayState');

test('tooltip shows the unread count', () => {
  assert.equal(s.trayTooltip(0), 'Oruinwan');
  assert.equal(s.trayTooltip(3), 'Oruinwan — 3 unread');
  assert.equal(s.trayTooltip('7'), 'Oruinwan — 7 unread');
  assert.equal(s.trayTooltip(NaN), 'Oruinwan');
  assert.equal(s.trayTooltip(-5), 'Oruinwan');
  assert.equal(s.trayTooltip(1e9), 'Oruinwan — 9999 unread');
});

test('tray icon by platform and unread state, and every file exists', () => {
  assert.equal(s.trayIconFile('darwin', 0), 'trayTemplate.png');
  assert.equal(s.trayIconFile('darwin', 2), 'trayUnreadTemplate.png');
  assert.equal(s.trayIconFile('win32', 0), 'tray.png');
  assert.equal(s.trayIconFile('win32', 1), 'tray-unread.png');
  assert.equal(s.trayIconFile('linux', 0), 'tray-32.png');
  assert.equal(s.trayIconFile('linux', 1), 'tray-unread-32.png');
  const dir = path.join(__dirname, '..', '..', 'assets', 'tray');
  for (const platform of ['darwin', 'win32', 'linux']) {
    for (const n of [0, 1]) {
      const file = s.trayIconFile(platform, n);
      assert.ok(fs.existsSync(path.join(dir, file)), file);
      if (platform !== 'linux') assert.ok(fs.existsSync(path.join(dir, file.replace('.png', '@2x.png'))), `${file} @2x`);
    }
  }
});

test('launch at login and quick reply support by platform', () => {
  assert.equal(s.supportsLaunchAtLogin('darwin'), true);
  assert.equal(s.supportsLaunchAtLogin('win32'), true);
  assert.equal(s.supportsLaunchAtLogin('linux'), false);
  assert.equal(s.supportsQuickReply('darwin'), true);
  assert.equal(s.supportsQuickReply('win32'), true);
  assert.equal(s.supportsQuickReply('linux'), false);
});

test('closing hides unless quitting (or no tray off macOS)', () => {
  assert.equal(s.closeAction({ platform: 'darwin', isQuitting: false, hasTray: false }), 'hide');
  assert.equal(s.closeAction({ platform: 'darwin', isQuitting: true, hasTray: true }), 'close');
  assert.equal(s.closeAction({ platform: 'win32', isQuitting: false, hasTray: true }), 'hide');
  assert.equal(s.closeAction({ platform: 'linux', isQuitting: false, hasTray: true }), 'hide');
  assert.equal(s.closeAction({ platform: 'linux', isQuitting: false, hasTray: false }), 'close');
  assert.equal(s.closeAction({ platform: 'win32', isQuitting: true, hasTray: true }), 'close');
});

test('quick reply payload validates ids and caps text', () => {
  assert.deepEqual(s.quickReplyPayload({ workspaceId: 'w1', channelId: 'c1', dmSessionId: '' }, '  hi '),
    { workspaceId: 'w1', channelId: 'c1', text: 'hi' });
  assert.deepEqual(s.quickReplyPayload({ workspaceId: 'w1', channelId: '', dmSessionId: 'd1' }, 'yo'),
    { workspaceId: 'w1', dmSessionId: 'd1', text: 'yo' });
  assert.equal(s.quickReplyPayload({ workspaceId: 'w1', channelId: 'c1' }, '   '), null);
  assert.equal(s.quickReplyPayload({ workspaceId: 'w 1', channelId: 'c1' }, 'hi'), null);
  assert.equal(s.quickReplyPayload({ workspaceId: 'w1', channelId: '../c' }, 'hi'), null);
  assert.equal(s.quickReplyPayload({ workspaceId: 'w1' }, 'hi'), null);
  assert.equal(s.quickReplyPayload(null, 'hi'), null);
  assert.equal(s.quickReplyPayload({ workspaceId: 'w1', channelId: 'c1' }, 42), null);
  assert.equal(s.quickReplyPayload({ workspaceId: 'w1', channelId: 'c1' }, 'x'.repeat(9000)).text.length, s.MAX_REPLY_LENGTH);
});

test('reply text from new and legacy event signatures', () => {
  assert.equal(s.replyText({ reply: 'new' }, 'old'), 'new');
  assert.equal(s.replyText({}, 'old'), 'old');
  assert.equal(s.replyText(undefined, undefined), '');
});

test('notification options: DND suppresses, reply only for conversations on supported platforms', () => {
  const target = { workspaceId: 'w1', channelId: 'c1', dmSessionId: '' };
  assert.equal(s.notificationOptions({ platform: 'darwin', title: 't', body: 'b', target, doNotDisturb: true }), null);
  assert.deepEqual(s.notificationOptions({ platform: 'darwin', title: 't', body: 'b', target, doNotDisturb: false }),
    { title: 't', body: 'b', hasReply: true, replyPlaceholder: 'Reply…' });
  assert.deepEqual(s.notificationOptions({ platform: 'linux', title: 't', body: 'b', target, doNotDisturb: false }),
    { title: 't', body: 'b' });
  assert.deepEqual(s.notificationOptions({
    platform: 'win32', title: 't', body: 'b', target: { workspaceId: 'w1', channelId: '', dmSessionId: '' }, doNotDisturb: false,
  }), { title: 't', body: 'b' });
});
