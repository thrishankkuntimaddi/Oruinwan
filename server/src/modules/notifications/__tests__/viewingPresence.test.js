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

describe('viewingPresence: threads, split panes and phones', () => {
    const TH = 'e'.repeat(24);
    beforeEach(() => viewing._reset());

    it('a thread counts only when that thread is open', () => {
        viewing.record('u1', 's1', { conversationType: 'channel', conversationId: CH, visible: true, focused: true });
        expect(viewing.isViewing('u1', CH, Date.now(), { threadId: TH })).toBe(false);
        viewing.record('u1', 's1', { conversationType: 'channel', conversationId: CH, threadId: TH, visible: true, focused: true });
        expect(viewing.isViewing('u1', CH, Date.now(), { threadId: TH })).toBe(true);
    });

    it('split-pane conversations are on screen too', async () => {
        viewing.record('u1', 's1', { conversationType: 'channel', conversationId: CH, conversations: [{ conversationType: 'dm', conversationId: DM }], visible: true, focused: true });
        expect(await viewing.isViewingAnywhere('u1', DM)).toBe(true);
    });

    it('an open phone app is viewing, but not "active" for push', async () => {
        viewing.record('u1', 'p1', { conversationType: 'dm', conversationId: DM, visible: true, focused: true, client: 'mobile' });
        expect(await viewing.isViewingAnywhere('u1', DM)).toBe(true);
        expect(await viewing.isActiveAnywhere('u1')).toBe(false);
    });
});
