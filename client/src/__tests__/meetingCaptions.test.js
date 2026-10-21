import { describe, it, expect, vi } from 'vitest';
import {
    CAPTURE_MARKERS, SegmentQueue, captureBannerText, captureStateFromSegments, isMarker, listNames, makeSegment,
    mergeSegments, offsetLabel, parseCaptureMarker, pendingConsent, recentCaptions, transcriptText,
} from '../features/huddles/capture/captions';

const at = (s) => new Date(Date.UTC(2026, 9, 21, 10, 0, s)).toISOString();
const seg = (speakerId, speakerName, text, s) => ({ speakerId, speakerName, text, startedAt: at(s), endedAt: at(s + 1) });

describe('makeSegment', () => {
    it('trims, collapses whitespace and caps the text', () => {
        const s = makeSegment({ speakerId: 'u1', speakerName: 'Ada', text: '  hello   there \n', startedAt: at(0) });
        expect(s.text).toBe('hello there');
        expect(s.startedAt).toBe(at(0));
        expect(s.endedAt).toBe(at(0));
        expect(makeSegment({ text: 'x'.repeat(5000), startedAt: at(0) }).text).toHaveLength(4000);
    });

    it('returns null for empty speech and never ends before it starts', () => {
        expect(makeSegment({ text: '   ' })).toBeNull();
        const s = makeSegment({ text: 'hi', startedAt: at(5), endedAt: at(2) });
        expect(s.endedAt).toBe(at(5));
    });
});

describe('mergeSegments', () => {
    it('drops the server copy of my own line and sorts by time', () => {
        const mine = seg('u1', 'Ada', 'first', 0);
        const merged = mergeSegments([seg('u2', 'Bo', 'second', 5), mine], [{ ...mine, _id: 'srv' }, seg('u2', 'Bo', 'third', 9)]);
        expect(merged.map((s) => s.text)).toEqual(['first', 'second', 'third']);
    });

    it('treats Date and ISO start times as the same line', () => {
        const a = seg('u1', 'Ada', 'x', 0);
        expect(mergeSegments([a], [{ ...a, startedAt: new Date(a.startedAt) }])).toHaveLength(1);
    });
});

describe('capture markers and consent', () => {
    const onRec = seg('u2', 'Bo', CAPTURE_MARKERS['recording:on'], 1);
    const onCc = seg('u3', 'Cy', CAPTURE_MARKERS['captions:on'], 2);

    it('parses marker lines only', () => {
        expect(parseCaptureMarker(CAPTURE_MARKERS['recording:off'])).toEqual({ kind: 'recording', on: false });
        expect(parseCaptureMarker('started recording the call')).toBeNull();
        expect(isMarker(onCc)).toBe(true);
    });

    it('works out who is recording or transcribing from the last marker', () => {
        const state = captureStateFromSegments([onRec, onCc, seg('u3', 'Cy', CAPTURE_MARKERS['captions:off'], 4)]);
        expect([...state.keys()]).toEqual(['u2']);
        expect(state.get('u2')).toMatchObject({ name: 'Bo', recording: true, transcribing: false });
    });

    it('forgets people who left the call', () => {
        expect(captureStateFromSegments([onRec, onCc], new Set(['u3'])).has('u2')).toBe(false);
    });

    it('asks me once per person and kind, never about myself', () => {
        const state = captureStateFromSegments([onRec, onCc, seg('me', 'Me', CAPTURE_MARKERS['captions:on'], 3)]);
        const pending = pendingConsent(state, 'me');
        expect(pending).toEqual([
            { userId: 'u2', name: 'Bo', kind: 'recording' },
            { userId: 'u3', name: 'Cy', kind: 'captions' },
        ]);
        expect(pendingConsent(state, 'me', new Set(['u2:recording']))).toHaveLength(1);
    });

    it('builds the banner text', () => {
        const state = captureStateFromSegments([onRec, onCc]);
        expect(captureBannerText(state, { myId: 'me' })).toBe('Bo is recording this call · Live captions on for Cy');
        expect(captureBannerText(new Map(), { myId: 'me', recordingLocal: true, captionsLocal: true })).toBe('You are recording this call · Live captions on for you');
        expect(captureBannerText(new Map(), { myId: 'me' })).toBe('');
    });

    it('lists names', () => {
        expect(listNames(['A'])).toBe('A');
        expect(listNames(['A', 'B', 'C', 'D', 'E'])).toBe('A, B and 3 others');
    });
});

describe('SegmentQueue', () => {
    const fakeTimers = () => {
        const timers = [];
        return {
            setTimer: (fn) => { timers.push(fn); return timers.length; },
            clearTimer: () => {},
            fire: () => timers.splice(0).forEach((fn) => fn()),
        };
    };

    it('batches until the interval, then sends', async () => {
        const send = vi.fn().mockResolvedValue({});
        const t = fakeTimers();
        const q = new SegmentQueue(send, { setTimer: t.setTimer, clearTimer: t.clearTimer });
        q.push(seg('u1', 'A', 'one', 0));
        q.push(seg('u1', 'A', 'two', 1));
        expect(send).not.toHaveBeenCalled();
        t.fire();
        await q.flush();
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0].map((s) => s.text)).toEqual(['one', 'two']);
        expect(q.pending).toBe(0);
    });

    it('sends at once when the batch is full', async () => {
        const send = vi.fn().mockResolvedValue({});
        const t = fakeTimers();
        const q = new SegmentQueue(send, { maxBatch: 2, setTimer: t.setTimer, clearTimer: t.clearTimer });
        q.push(seg('u1', 'A', 'one', 0));
        q.push(seg('u1', 'A', 'two', 1));
        await q.flush();
        expect(send).toHaveBeenCalledTimes(1);
    });

    it('keeps a batch for retry after a network error, but drops it after a 409', async () => {
        const t = fakeTimers();
        const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({});
        const q = new SegmentQueue(send, { setTimer: t.setTimer, clearTimer: t.clearTimer });
        q.push(seg('u1', 'A', 'one', 0));
        await q.flush();
        expect(q.pending).toBe(1);
        await q.flush();
        expect(q.pending).toBe(0);
        expect(send).toHaveBeenCalledTimes(2);

        const full = vi.fn().mockRejectedValue(Object.assign(new Error('full'), { response: { status: 409 } }));
        const q2 = new SegmentQueue(full, { setTimer: t.setTimer, clearTimer: t.clearTimer });
        q2.push(seg('u1', 'A', 'one', 0));
        await q2.flush();
        expect(q2.pending).toBe(0);
    });
});

describe('formatting', () => {
    it('labels offsets from the call start', () => {
        expect(offsetLabel(at(75), at(0))).toBe('01:15');
        expect(offsetLabel(new Date(Date.parse(at(0)) + 3723000).toISOString(), at(0))).toBe('1:02:03');
    });

    it('renders a plain transcript', () => {
        expect(transcriptText([seg('u1', 'Ada', 'hi', 0), seg('u2', 'Bo', 'hello', 65)])).toBe('[00:00] Ada: hi\n[01:05] Bo: hello');
    });

    it('keeps only recent spoken lines for the caption strip', () => {
        const now = Date.parse(at(30));
        const list = [seg('u1', 'A', 'old', 0), seg('u2', 'B', CAPTURE_MARKERS['captions:on'], 25), seg('u1', 'A', 'new', 26)];
        expect(recentCaptions(list, { now }).map((s) => s.text)).toEqual(['new']);
    });
});
