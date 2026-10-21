// Asks for the microphone or camera at the moment a call needs it: first a short note on why
// (PermissionPrompt in CallPrompts.jsx), then the system dialog. If it was turned down for good,
// the note offers system settings instead. Off Android the WebView or browser asks by itself.
import { create } from 'zustand';
import { openAppSettings, permissionState, requestPermission } from '../../native/callSession.js';
import { permissionStep } from './callLogic.js';

/** The note on screen: { kind: 'microphone'|'camera', step: 'explain'|'settings' } or null. */
export const usePermissionAsk = create(() => ({ ask: null }));

let answer = null;

function show(kind, step) {
  return new Promise((resolve) => {
    answer?.(false);
    answer = resolve;
    usePermissionAsk.setState({ ask: { kind, step } });
  });
}

function close(result) {
  const done = answer;
  answer = null;
  usePermissionAsk.setState({ ask: null });
  done?.(result);
}

/** The person tapped "Allow" on the note: ask the system. */
export async function allowFromPrompt() {
  const ask = usePermissionAsk.getState().ask;
  if (!ask) return;
  if (ask.step === 'settings') {
    await openAppSettings();
    close(false);
    return;
  }
  const state = await requestPermission(ask.kind);
  if (state === 'granted') return close(true);
  // Turned down again: from now on only settings can allow it.
  if (state === 'denied') usePermissionAsk.setState({ ask: { kind: ask.kind, step: 'settings' } });
  else close(false);
}

export const dismissPermissionPrompt = () => close(false);

/** true when the microphone or camera may be used now (asking first if needed). */
export async function ensureAllowed(kind) {
  const state = await permissionState(kind);
  const step = permissionStep(state);
  if (step === 'go') return true;
  return show(kind, step);
}
