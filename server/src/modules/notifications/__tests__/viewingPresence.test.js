const viewing = require('../viewingPresence');

const DM = 'a'.repeat(24);
const CH = 'b'.repeat(24);

describe('viewingPresence', () => {
    beforeEach(() => viewing._reset());

    it('tracks what an active session shows', () => {
        viewing.record('u1', 's1', { conversationType: 'dm', conversationId: DM, visible: true, focused: true }, 1000);
        expect(viewing.isActive('u1', 2000)).toBe(true);
        expect(viewing.isViewing('u1', DM, 2000)).toBe(true);
        expect(viewing.isViewing('u1', CH, 2000)).toBe(false);
        expect(viewing.isActive('u2', 2000)).toBe(false);
    });

    it('hidden or unfocused sessions are not active', () => {
        viewing.record('u1', 's1', { conversationType: 'dm', conversationId: DM, visible: true, focused: false });
        expect(viewing.isActive('u1')).toBe(false);
        viewing.record('u1', 's1', { conversationType: 'dm', conversationId: DM, visible: false, focused: true });
        expect(viewing.isViewing('u1', DM)).toBe(false);
    });

    it('goes stale without a heartbeat and clears on disconnect', () => {
        viewing.record('u1', 's1', { visible: true, focused: true }, 0);
        expect(viewing.isActive('u1', viewing.ACTIVE_TTL_MS + 1)).toBe(false);
        viewing.record('u1', 's2', { visible: true, focused: true });
        viewing.clear('u1', 's2');
        expect(viewing.isActive('u1')).toBe(false);
    });

    it('ignores malformed payloads', () => {
        viewing.record('u1', 's1', { conversationType: 'evil', conversationId: '$where', visible: 'yes', focused: true });
        expect(viewing.isActive('u1')).toBe(false);
        expect(viewing.isViewing('u1', '$where')).toBe(false);
    });

    it('registers the socket event', () => {
        const handlers = {};
        const socket = { id: 's9', on: (ev, fn) => { handlers[ev] = fn; } };
        viewing.registerViewingHandlers(socket, 'u5');
        handlers['presence:viewing']({ conversationType: 'channel', conversationId: CH, visible: true, focused: true });
        expect(viewing.isViewing('u5', CH)).toBe(true);
        handlers.disconnect();
        expect(viewing.isActive('u5')).toBe(false);
    });
});
