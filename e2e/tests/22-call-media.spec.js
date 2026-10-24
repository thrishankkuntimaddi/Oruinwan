'use strict';

/**
 * A DM call end to end, for what people hit in real calls:
 * - the caller sees "Calling…" (no clock) until the other person picks up;
 * - a camera turned on in a voice call reaches the other side (renegotiation);
 * - a screen shared before the other person joins still reaches them;
 * - the whiteboard in the call panel draws, and the other person sees the strokes;
 * - the agenda saves as soon as an item is added, and the other person sees it.
 */

const { test, expect } = require('@playwright/test');
const { login, openWorkspace, waitForComposerReady, openDm } = require('./helpers');

// Record every RTCPeerConnection, and share a canvas instead of a real screen.
const setup = () => {
  const Orig = window.RTCPeerConnection;
  window.__pcs = [];
  window.RTCPeerConnection = function (...args) { const pc = new Orig(...args); window.__pcs.push(pc); return pc; };
  window.RTCPeerConnection.prototype = Orig.prototype;
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    let n = 0;
    setInterval(() => { ctx.fillStyle = n++ % 2 ? '#c80' : '#08c'; ctx.fillRect(0, 0, 320, 180); }, 100);
    return canvas.captureStream(10);
  };
};
const peerConnected = (page) => page.waitForFunction(() => window.__pcs.some((pc) => pc.connectionState === 'connected'), null, { timeout: 30_000 });

// Is a video frame from the other person actually playing on this page?
const remoteVideoPlaying = (page) => page.waitForFunction(() => {
  const v = document.querySelector('[data-testid="video-tile-remote"][data-video="on"] video');
  return !!v && v.readyState >= 2 && v.videoWidth > 0;
}, null, { timeout: 30_000 });

test('a DM call: rings first, video and screen reach the other side, whiteboard and agenda are shared', async ({ browser }) => {
  test.setTimeout(180_000);
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 1440, height: 900 } }),
    browser.newContext({ viewport: { width: 1440, height: 900 } }),
  ]);
  await Promise.all(contexts.map((c) => c.addInitScript(setup)));
  const [alice, bob] = await Promise.all(contexts.map((c) => c.newPage()));

  await login(bob, 'bob');
  await openWorkspace(bob);
  await login(alice, 'alice');
  await openWorkspace(alice);
  await openDm(alice, 'bob');
  await openDm(bob, 'alice');
  await Promise.all([waitForComposerReady(alice), waitForComposerReady(bob)]);

  // Alice calls (voice). Until Bob answers she sees "Calling…", not a running clock.
  await alice.locator('button[title="Start Voice Call"], button[title="Start huddle"]').first().click();
  const aliceCall = alice.getByTestId('call-screen');
  await expect(aliceCall).toBeVisible();
  await expect(alice.getByTestId('call-time')).toHaveText('Calling…');

  // Alice shares her screen before Bob is in: Bob must still get it when he joins.
  await alice.getByTestId('call-screen-share').click();
  await expect(aliceCall).toContainText('Sharing your screen');
  await bob.waitForTimeout(1500);
  await expect(alice.getByTestId('call-time')).toHaveText('Calling…');

  const ring = bob.getByTestId('incoming-call');
  await expect(ring).toContainText('alice');
  await bob.getByTestId('incoming-call-accept').click();
  const bobCall = bob.getByTestId('call-screen');
  await expect(bobCall).toContainText('2 participants');
  await Promise.all([peerConnected(alice), peerConnected(bob)]);

  // Answered: the clock runs from now.
  await expect(alice.getByTestId('call-time')).toHaveText(/^0:0\d$/);
  // Alice's screen plays on Bob's side.
  await remoteVideoPlaying(bob);

  // Alice stops sharing; Bob turns his camera on in this voice call: Alice sees his video.
  await alice.getByTestId('call-screen-share').click();
  await bob.getByTestId('call-camera').click();
  await remoteVideoPlaying(alice);

  // The call panel: whiteboard. Alice draws; Bob sees the stroke.
  await alice.getByTestId('call-workspace').click();
  await bob.getByTestId('call-workspace').click();
  await alice.getByTestId('huddle-tab-whiteboard').click();
  await bob.getByTestId('huddle-tab-whiteboard').click();
  const board = alice.getByTestId('whiteboard-canvas');
  await expect(board).toBeVisible();
  await expect(alice.getByTestId('whiteboard-mode')).toContainText('Live', { timeout: 20_000 });
  await expect(bob.getByTestId('whiteboard-mode')).toContainText('Live', { timeout: 20_000 });
  const box = await board.boundingBox();
  await alice.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await alice.mouse.down();
  for (let i = 1; i <= 10; i += 1) await alice.mouse.move(box.x + box.width * (0.2 + i * 0.04), box.y + box.height * (0.3 + i * 0.02));
  await alice.mouse.up();
  const inked = (page) => page.waitForFunction(() => {
    const c = document.querySelector('[data-testid="whiteboard-canvas"]');
    if (!c) return false;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
    return false;
  }, null, { timeout: 20_000 });
  await inked(alice);
  await inked(bob);

  // Agenda: added items save at once; Bob sees them without anyone pressing Save.
  await alice.getByTestId('huddle-tab-agenda').click();
  await bob.getByTestId('huddle-tab-agenda').click();
  await alice.getByLabel('New agenda item').fill('Launch plan');
  await alice.getByLabel('New agenda item').press('Enter');
  await expect(alice.getByTestId('agenda-status')).toContainText('Saved', { timeout: 15_000 });
  await expect(bob.getByTestId('agenda-item')).toHaveText(/Launch plan/, { timeout: 15_000 });

  await aliceCall.getByTitle('Leave huddle').click();
  await expect(bobCall).toBeHidden();
  await Promise.all(contexts.map((c) => c.close()));
});
