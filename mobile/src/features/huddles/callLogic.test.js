import { describe, expect, it } from 'vitest';
import {
  callPlace,
  deviceLabel,
  elsewhereCall,
  endedMessage,
  modelFromUserAgent,
  permissionStep,
  promptForError,
  scopeOf,
  switchPrompt,
} from './callLogic.js';

describe('device names', () => {
  it('reads the model from an Android user agent, ignoring the reduced "K"', () => {
    expect(modelFromUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit')).toBe('Pixel 8');
    expect(modelFromUserAgent('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit')).toBeNull();
    expect(modelFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBeNull();
  });

  it('prefers the native name, then the model, then a generic label', () => {
    expect(deviceLabel({ nativeName: 'Google Pixel 8' })).toBe('Google Pixel 8');
    expect(deviceLabel({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B)' })).toBe('SM-S918B');
    expect(deviceLabel({ tablet: true })).toBe('Android tablet');
    expect(deviceLabel()).toBe('Android phone');
  });
});

describe('switch and move prompts', () => {
  const request = { huddleId: 'h2', scope: { channelId: 'c2' }, start: false };

  it('asks to switch from a call on this device', () => {
    const p = switchPrompt({ kind: 'local', current: { channelName: 'general' }, request });
    expect(p).toMatchObject({ kind: 'local', confirmLabel: 'Switch', request });
    expect(p.body).toContain('#general');
  });

  it('names the other device for a call there, and offers to move the same call', () => {
    expect(promptForError({ code: 'ALREADY_IN_CALL', current: { dmId: 'd1', device: { label: 'MacBook' } } }, request).body).toMatch(/a direct message on MacBook/);
    const move = promptForError({ code: 'ALREADY_IN_CALL', sameCall: true, current: { device: { label: 'MacBook' } } }, request);
    expect(move).toMatchObject({ kind: 'move', confirmLabel: 'Move here' });
    expect(move.body).toContain('MacBook');
  });

  it('ignores other errors and missing requests', () => {
    expect(promptForError({ code: 'HUDDLE_FULL' }, request)).toBeNull();
    expect(promptForError({ code: 'ALREADY_IN_CALL' }, null)).toBeNull();
    expect(callPlace({})).toBe('a huddle');
  });
});

describe('my call elsewhere', () => {
  const active = { huddleId: 'h1', socketId: 's-laptop', channelId: 'c1' };
  it('is shown for another connection only', () => {
    expect(elsewhereCall(active, { socketId: 's-phone' })).toBe(active);
    expect(elsewhereCall(active, { socketId: 's-laptop' })).toBeNull();
    expect(elsewhereCall(null)).toBeNull();
    expect(elsewhereCall({ huddleId: null })).toBeNull();
  });

  it('turns a server payload into a scope', () => {
    expect(scopeOf({ channelId: 7 })).toEqual({ channelId: '7' });
    expect(scopeOf({ dmId: 'd' })).toEqual({ dmId: 'd' });
    expect(scopeOf({ workspaceId: 'w' })).toEqual({ workspaceId: 'w' });
  });

  it('explains why a call ended here', () => {
    expect(endedMessage('moved', { label: 'Pixel 8' })).toBe('Call moved to Pixel 8.');
    expect(endedMessage('moved')).toBe('Call moved to another device.');
    expect(endedMessage('switched')).toMatch(/another call/);
    expect(endedMessage('ended')).toBeNull();
  });
});

describe('permissions', () => {
  it('asks, explains or sends to settings', () => {
    expect(permissionStep('granted')).toBe('go');
    expect(permissionStep('prompt')).toBe('explain');
    expect(permissionStep('prompt-with-rationale')).toBe('explain');
    expect(permissionStep('denied')).toBe('settings');
  });
});
