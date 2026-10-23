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
  const aliceCall = alice.getByTestId('call-screen');
  await expect(aliceCall).toBeVisible();

  // Bob's app rings with Alice's name; he accepts and joins her call (not a second one).
  const ring = bob.getByTestId('incoming-call');
  await expect(ring).toContainText('alice');
  await expect(ring).toContainText('Incoming voice call');
  await bob.getByTestId('incoming-call-accept').click();
  await expect(ring).toBeHidden();
  const bobCall = bob.getByTestId('call-screen');
  await expect(bobCall).toContainText('2 participants');
  await expect(aliceCall).toContainText('2 participants');
  await expect(bobCall).toContainText('alice');

  await Promise.all([peerConnected(alice), peerConnected(bob)]);

  // Minimise to the small call (the app stays usable), then open the full call again.
  await alice.getByTestId('call-minimise').click();
  await expect(aliceCall).toBeHidden();
  await expect(alice.getByTestId('call-mini')).toBeVisible();
  await alice.getByTestId('mini-expand').click();
  await expect(aliceCall).toBeVisible();

  // Alice leaves; Bob sees it and the call ends when he leaves too.
  await aliceCall.getByTitle('Leave huddle').click();
  await expect(aliceCall).toBeHidden();
  await expect(bobCall).toContainText('1 participant');
  await bobCall.getByTitle('Leave huddle').click();
  await expect(bobCall).toBeHidden();

  await Promise.all(contexts.map((c) => c.close()));
});

test('a call moves from one of my devices to another', async ({ browser }) => {
  // Two browser profiles = two devices for Alice (each has its own device id).
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  await Promise.all(contexts.map((c) => c.addInitScript(trackPeerConnections)));
  const [laptop, phone, bob] = await Promise.all(contexts.map((c) => c.newPage()));
  await login(bob, 'bob'); await openWorkspace(bob);
  await login(laptop, 'alice'); await openWorkspace(laptop);
  await login(phone, 'alice'); await openWorkspace(phone);
  await openDm(laptop, 'bob'); await openDm(bob, 'alice');
  await Promise.all([waitForComposerReady(laptop), waitForComposerReady(bob)]);

  await laptop.locator('button[title="Start Voice Call"], button[title="Start huddle"]').first().click();
  await expect(laptop.getByTestId('call-screen')).toBeVisible();
  await bob.getByTestId('incoming-call-accept').click();
  await expect(bob.getByTestId('call-screen')).toContainText('2 participants');

  // The other device shows "In a call on … · Move here". Starting a call in that same DM there
  // asks to move the call (not to start a second one); saying no keeps it on the laptop.
  await expect(phone.getByTestId('call-elsewhere')).toBeVisible();
  await openDm(phone, 'bob');
  await waitForComposerReady(phone);
  await phone.locator('button[title="Start Voice Call"], button[title="Start huddle"]').first().click();
  await expect(phone.getByTestId('call-conflict')).toContainText('Move it to this device');
  await phone.getByTestId('call-conflict-no').click();
  await expect(laptop.getByTestId('call-screen')).toBeVisible();

  // "Move here": the call moves and the laptop is told.
  await phone.getByTestId('call-move-here').click();
  await expect(phone.getByTestId('call-screen')).toBeVisible();
  await expect(laptop.getByTestId('call-screen')).toBeHidden();
  await expect(laptop.getByText(/Call moved to/)).toBeVisible();
  await expect(bob.getByTestId('call-screen')).toContainText('2 participants');
  await peerConnected(phone);

  await phone.getByTitle('Leave huddle').click();
  await bob.getByTitle('Leave huddle').click();
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
  const aliceCall = alice.getByTestId('call-screen');
  await expect(aliceCall.getByTestId('video-tile-local').locator('video')).toBeVisible();

  await expect(bob.getByTestId('incoming-call')).toContainText('Incoming video call');
  await bob.getByTestId('incoming-call-accept').click();
  const bobCall = bob.getByTestId('call-screen');
  await expect(bobCall.getByTestId('video-tile-local').locator('video')).toBeVisible();
  await Promise.all([peerConnected(alice), peerConnected(bob)]);

  // Each side is actually receiving the other's video frames.
  const remoteVideoPlaying = (page) => page.waitForFunction(() => {
    const v = document.querySelector('[data-testid="video-tile-remote"] video');
    return v && v.videoWidth > 0;
  }, null, { timeout: 20_000 });
  await Promise.all([remoteVideoPlaying(alice), remoteVideoPlaying(bob)]);

  // Turning the camera off shows the initial instead of video on the other side.
  await aliceCall.getByTitle('Turn camera off').click();
  await expect(bobCall.getByTestId('video-tile-remote').locator('video')).toHaveCount(0);

  await aliceCall.getByTitle('Leave huddle').click();
  await bobCall.getByTitle('Leave huddle').click();
  await Promise.all(contexts.map((c) => c.close()));
});
