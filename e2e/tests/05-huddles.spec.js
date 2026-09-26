'use strict';

const { test, expect } = require('@playwright/test');
const { login, openWorkspace, waitForComposerReady, openDm } = require('./helpers');


// Record every RTCPeerConnection so the test can check the call really connects.
const trackPeerConnections = () => {
  const Orig = window.RTCPeerConnection;
  window.__pcs = [];
  window.RTCPeerConnection = function (...args) { const pc = new Orig(...args); window.__pcs.push(pc); return pc; };
  window.RTCPeerConnection.prototype = Orig.prototype;
};
const peerConnected = (page) => page.waitForFunction(() => window.__pcs.some((pc) => pc.connectionState === 'connected'), null, { timeout: 30_000 });

test('a DM voice huddle: start, join from the other side, connect, leave', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  await Promise.all(contexts.map((c) => c.addInitScript(trackPeerConnections)));
  const [alice, bob] = await Promise.all(contexts.map((c) => c.newPage()));

  await login(bob, 'bob');
  await openWorkspace(bob);
  await login(alice, 'alice');
  await openWorkspace(alice);

  await openDm(alice, 'bob');
  await openDm(bob, 'alice');
  // The conversation is fully loaded (real DM session + keys) once the composer is ready.
  await Promise.all([waitForComposerReady(alice), waitForComposerReady(bob)]);

  // Alice starts the call.
  await alice.locator('button[title="Start Voice Call"], button[title="Start huddle"]').first().click();
  const aliceOverlay = alice.getByTestId('huddle-overlay');
  await expect(aliceOverlay).toBeVisible();

  // Bob is offered the live huddle and joins it (not a second, separate huddle).
  const banner = bob.getByTestId('huddle-announcement');
  await expect(banner).toContainText('alice');
  await banner.getByRole('button', { name: 'Join' }).click();
  const bobOverlay = bob.getByTestId('huddle-overlay');
  await expect(bobOverlay).toContainText('2 participants');
  await expect(aliceOverlay).toContainText('2 participants');
  await expect(bobOverlay).toContainText('alice');

  await Promise.all([peerConnected(alice), peerConnected(bob)]);

  // Alice leaves; Bob sees it and the call ends when he leaves too.
  await aliceOverlay.getByTitle('Leave huddle').click();
  await expect(aliceOverlay).toBeHidden();
  await expect(bobOverlay).toContainText('1 participant');
  await bobOverlay.getByTitle('Leave huddle').click();
  await expect(bobOverlay).toBeHidden();

  await Promise.all(contexts.map((c) => c.close()));
});

test('a DM video call shows both cameras', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  await Promise.all(contexts.map((c) => c.addInitScript(trackPeerConnections)));
  const [alice, bob] = await Promise.all(contexts.map((c) => c.newPage()));
  await login(bob, 'bob'); await openWorkspace(bob);
  await login(alice, 'alice'); await openWorkspace(alice);
  await openDm(alice, 'bob'); await openDm(bob, 'alice');
  await Promise.all([waitForComposerReady(alice), waitForComposerReady(bob)]);

  await alice.locator('button[title="Start Video Call"]').click();
  const aliceOverlay = alice.getByTestId('huddle-overlay');
  await expect(aliceOverlay.getByTestId('video-tile-local').locator('video')).toBeVisible();

  const banner = bob.getByTestId('huddle-announcement');
  await banner.getByRole('button', { name: 'Join' }).click();
  const bobOverlay = bob.getByTestId('huddle-overlay');
  await expect(bobOverlay.getByTestId('video-tile-local').locator('video')).toBeVisible();
  await Promise.all([peerConnected(alice), peerConnected(bob)]);

  // Each side is actually receiving the other's video frames.
  const remoteVideoPlaying = (page) => page.waitForFunction(() => {
    const v = document.querySelector('[data-testid="video-tile-remote"] video');
    return v && v.videoWidth > 0;
  }, null, { timeout: 20_000 });
  await Promise.all([remoteVideoPlaying(alice), remoteVideoPlaying(bob)]);

  // Turning the camera off shows the initial instead of video on the other side.
  await aliceOverlay.getByTitle('Turn camera off').click();
  await expect(bobOverlay.getByTestId('video-tile-remote').locator('video')).toHaveCount(0);

  await aliceOverlay.getByTitle('Leave huddle').click();
  await bobOverlay.getByTitle('Leave huddle').click();
  await Promise.all(contexts.map((c) => c.close()));
});
