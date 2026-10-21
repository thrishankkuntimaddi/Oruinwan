import { describe, expect, it, vi } from 'vitest';
import {
  MAX_RECORDING_BYTES, callTarget, captionLines, createSegmentQueue, mergeSegments, noticeKind, offsetLabel, pickRecordingMime, recordingFile, recordingNotice,
  recordingProblem, recordingStateFrom, transcriptText,
} from './callMedia.js';

const seg = (speakerId, text, at, name = speakerId) => ({ id: `${speakerId}${at}`, speakerId, speakerName: name, text, startedAt: `2026-10-21T10:${at}.000Z` });

describe('call targets', () => {
  it('sends a scheduled meeting’s call to the meeting, other huddles to the huddle', () => {
    expect(callTarget('meeting-64b0c0ffee')).toEqual({ kind: 'meeting', id: '64b0c0ffee' });
    expect(callTarget('3f1c-uuid')).toEqual({ kind: 'huddle', id: '3f1c-uuid' });
    expect(callTarget('')).toBeNull();
  });
});

describe('recording format', () => {
  it('prefers MP4/AAC on iOS and WebM/Opus elsewhere, by what the recorder supports', () => {
    const all = () => true;
    expect(pickRecordingMime(all, { ios: true })).toBe('audio/mp4;codecs=mp4a.40.2');
    expect(pickRecordingMime(all, { ios: false })).toBe('audio/webm;codecs=opus');
    expect(pickRecordingMime((t) => t === 'audio/mp4', { ios: false })).toBe('audio/mp4');
    expect(pickRecordingMime(() => false)).toBe('');
    expect(pickRecordingMime(undefined)).toBe('');
    expect(pickRecordingMime(() => {
      throw new Error('nope');
    })).toBe('');
  });

  it('names the upload so the server accepts it', () => {
    const at = '2026-10-21T10:15:00Z';
    expect(recordingFile('audio/webm;codecs=opus', at)).toEqual({ type: 'audio/webm', name: 'call-2026-10-21-10-15.webm' });
    expect(recordingFile('audio/mp4;codecs=mp4a.40.2', at)).toEqual({ type: 'audio/mp4', name: 'call-2026-10-21-10-15.m4a' });
    expect(recordingFile('', at).type).toBe('audio/webm');
  });

  it('refuses empty and oversized recordings', () => {
    expect(recordingProblem(0)).toMatch(/Nothing/);
    expect(recordingProblem(MAX_RECORDING_BYTES + 1)).toMatch(/500 MB/);
    expect(recordingProblem(1024)).toBeNull();
  });
});

describe('recording consent notices', () => {
  it('round-trips start and stop notices', () => {
    expect(noticeKind(recordingNotice(true, 'Ana'))).toBe('started');
    expect(noticeKind(recordingNotice(false, 'Ana'))).toBe('stopped');
    expect(noticeKind('I started the recording yesterday')).toBeNull();
  });

  it('knows who records from the latest notice', () => {
    const started = seg('ana', recordingNotice(true, 'Ana'), '00:00', 'Ana');
    expect(recordingStateFrom([started])).toMatchObject({ by: 'ana', byName: 'Ana' });
    expect(recordingStateFrom([started, seg('ana', recordingNotice(false, 'Ana'), '05:00')])).toBeNull();
    // Someone else's stop notice doesn't end Ana's recording.
    expect(recordingStateFrom([started, seg('bo', recordingNotice(false, 'Bo'), '05:00')])).toMatchObject({ by: 'ana' });
  });
});

describe('transcript lines', () => {
  it('merges without duplicates, in time order', () => {
    const a = seg('ana', 'hello', '00:05');
    const b = seg('bo', 'hi', '00:02');
    const merged = mergeSegments([a], [b, { ...a, id: 'server-id' }, { ...b, text: '  ' }]);
    expect(merged.map((s) => s.text)).toEqual(['hi', 'hello']);
  });

  it('renders offsets and the AI transcript without notices', () => {
    expect(offsetLabel('2026-10-21T10:01:05Z', '2026-10-21T10:00:00Z')).toBe('1:05');
    expect(offsetLabel('2026-10-21T11:00:05Z', '2026-10-21T10:00:00Z')).toBe('1:00:05');
    const text = transcriptText([seg('ana', recordingNotice(true, 'Ana'), '00:00', 'Ana'), seg('ana', 'Ship Friday', '00:10', 'Ana'), seg('bo', 'Agreed', '01:10', 'Bo')]);
    expect(text).toBe('[0:00] Ana: Ship Friday\n[1:00] Bo: Agreed');
  });

  it('shows the last caption lines plus my line in progress', () => {
    const lines = captionLines([seg('a', 'one', '00:01'), seg('me', 'two', '00:02'), seg('b', 'three', '00:03')], 'four', { max: 3, me: 'me' });
    expect(lines.map((l) => `${l.name}:${l.text}`)).toEqual(['You:two', 'b:three', 'You:four']);
    expect(lines[2].live).toBe(true);
  });
});

describe('caption queue', () => {
  it('sends in batches, skips duplicates and keeps lines after a network error', async () => {
    const send = vi.fn().mockRejectedValueOnce(Object.assign(new Error('offline'), { status: 0 })).mockResolvedValue({ added: 2 });
    const q = createSegmentQueue(send, { batch: 10 });
    expect(q.push(seg('me', 'one', '00:01'))).toBe(true);
    expect(q.push(seg('me', 'one', '00:01'))).toBe(false);
    q.push(seg('me', 'two', '00:02'));
    await expect(q.flush()).rejects.toThrow('offline');
    expect(q.pending()).toBe(2);
    await q.flush();
    expect(q.pending()).toBe(0);
    expect(send).toHaveBeenLastCalledWith([expect.objectContaining({ text: 'one' }), expect.objectContaining({ text: 'two' })]);
    expect(q.push(seg('me', 'one', '00:01'))).toBe(false); // already sent
  });

  it('stops for good when the transcript is full (409)', async () => {
    const q = createSegmentQueue(vi.fn().mockRejectedValue(Object.assign(new Error('full'), { status: 409 })));
    q.push(seg('me', 'one', '00:01'));
    await expect(q.flush()).rejects.toThrow('full');
    expect(q.isFull()).toBe(true);
    expect(q.push(seg('me', 'two', '00:02'))).toBe(false);
  });

  it('caps the queue and trims long lines', () => {
    const q = createSegmentQueue(vi.fn(), { max: 2 });
    q.push(seg('me', 'a', '00:01'));
    q.push(seg('me', 'b', '00:02'));
    q.push(seg('me', 'x'.repeat(5000), '00:03'));
    expect(q.pending()).toBe(2);
  });
});
