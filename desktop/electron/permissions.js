'use strict';

/**
 * Microphone, camera and screen access for calls, as the operating system sees it.
 *
 * Chromium's own permission prompt is answered by main.js (the app's page is always allowed),
 * but macOS and Windows have their own privacy switches on top. macOS asks once per app
 * (systemPreferences.askForMediaAccess); when the person said no, only System Settings can
 * turn it back on, so the app explains that and offers to open the right page.
 *
 * Pure helpers here; main.js does the Electron calls.
 */

/** 'microphone' | 'camera' kinds a Chromium media request needs ({ mediaTypes: ['audio', 'video'] }). */
function mediaKinds(details) {
  const types = (details && Array.isArray(details.mediaTypes)) ? details.mediaTypes : [];
  const kinds = [];
  if (types.includes('audio')) kinds.push('microphone');
  if (types.includes('video')) kinds.push('camera');
  // Older Chromium builds send no mediaTypes: treat it as a microphone request (calls start with audio).
  return kinds.length ? kinds : ['microphone'];
}

/** What to do for one kind, from systemPreferences.getMediaAccessStatus(). */
function accessAction(status, platform) {
  if (status === 'granted') return 'allow';
  // macOS can still show its own prompt the first time.
  if (status === 'not-determined') return platform === 'darwin' ? 'ask' : 'allow';
  if (status === 'denied' || status === 'restricted') return 'blocked';
  // 'unknown' (Linux, or an OS that doesn't report it): let Chromium try.
  return 'allow';
}

const LABEL = { microphone: 'microphone', camera: 'camera', screen: 'screen' };

/** The system settings page where the person turns access back on. */
function settingsUrl(kind, platform) {
  if (platform === 'darwin') {
    const pane = { microphone: 'Privacy_Microphone', camera: 'Privacy_Camera', screen: 'Privacy_ScreenCapture' }[kind];
    return pane ? `x-apple.systempreferences:com.apple.preference.security?${pane}` : null;
  }
  if (platform === 'win32') {
    return { microphone: 'ms-settings:privacy-microphone', camera: 'ms-settings:privacy-webcam' }[kind] || null;
  }
  return null;
}

/** The explanation shown when the operating system blocks access. */
function blockedMessage(kind, platform) {
  const what = LABEL[kind] || kind;
  if (platform === 'darwin') {
    const pane = { microphone: 'Microphone', camera: 'Camera', screen: 'Screen & System Audio Recording' }[kind] || 'Privacy';
    return {
      message: `Oruinwan can't use your ${what}`,
      detail: `Turn on Oruinwan in System Settings → Privacy & Security → ${pane}.`
        + (kind === 'screen' ? ' Then quit and reopen Oruinwan.' : ''),
    };
  }
  if (platform === 'win32') {
    return {
      message: `Oruinwan can't use your ${what}`,
      detail: `Turn on access in Settings → Privacy & security → ${kind === 'camera' ? 'Camera' : 'Microphone'}, including "Let desktop apps access your ${what}".`,
    };
  }
  return { message: `Oruinwan can't use your ${what}`, detail: `Check that a ${what} is connected and not used by another app.` };
}

module.exports = { mediaKinds, accessAction, settingsUrl, blockedMessage };
