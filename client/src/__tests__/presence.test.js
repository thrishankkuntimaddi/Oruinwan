import { describe, it, expect } from 'vitest';
import { presenceState, presenceLabel } from '../shared/utils/presence';

describe('presence', () => {
    it('treats "active" (what the server sends on connect) as online', () => {
        expect(presenceState({ status: 'active' })).toBe('online');
        expect(presenceLabel({ status: 'active' })).toBe('Active now');
    });
    it('maps every spelling to an Avatar state', () => {
        expect(presenceState({ status: 'online' })).toBe('online');
        expect(presenceState({ status: 'idle' })).toBe('away');
        expect(presenceState({ status: 'away' })).toBe('away');
        expect(presenceState({ status: 'dnd' })).toBe('busy');
        expect(presenceState({ status: 'offline' })).toBe('offline');
        expect(presenceState({})).toBe('offline');
        expect(presenceState({ isOnline: true })).toBe('online');
    });
    it('labels', () => {
        expect(presenceLabel({ status: 'idle' })).toBe('Away');
        expect(presenceLabel({ status: 'dnd' })).toBe('Do not disturb');
        expect(presenceLabel({ status: 'offline' })).toBe('Offline');
    });
});
