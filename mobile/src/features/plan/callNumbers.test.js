// Call limits on the phone use the server's numbers; 10 people / 30 minutes are only fallbacks.
// A device id the server made is kept when this install has none.
import { describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => new Map());
vi.mock('../../native/storage.js', () => ({
  prefs: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) },
  secure: { get: async () => null, set: async () => {}, remove: async () => {} },
}));

import { callFullText, timeLimitEndedText, timeWarningText, CALL_FULL, TIME_LIMIT_ENDED } from './planText.js';
import { adoptDeviceId } from '../../data/live/http.js';

describe('call numbers', () => {
  it('come from the server, with 10 / 30 as fallbacks', () => {
    expect(callFullText(6)).toBe('This call is full — 6 people on the free plan');
    expect(callFullText()).toBe(CALL_FULL);
    expect(CALL_FULL).toContain('10 people');
    expect(timeLimitEndedText(45)).toContain("free plan's 45-minute limit");
    expect(TIME_LIMIT_ENDED).toContain('30-minute');
    expect(timeWarningText({ minutesLeft: 5, maxMinutes: 20 })).toBe('5 minutes left — free plan calls end at 20 minutes');
    expect(timeWarningText({ minutesLeft: 5, maxMinutes: null })).toBe('5 minutes left — free plan calls end at 30 minutes');
  });
});

describe('server device id', () => {
  it('is kept only when the install has none', () => {
    store.clear();
    expect(adoptDeviceId('srv-abcdef-123')).toBe(true);
    expect(store.get('device.id')).toBe('srv-abcdef-123');
    expect(adoptDeviceId('srv-other-456')).toBe(false);
    expect(adoptDeviceId(null)).toBe(false);
  });
});
