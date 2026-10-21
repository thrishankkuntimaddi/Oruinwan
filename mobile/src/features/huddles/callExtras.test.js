import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const adapter = {
  huddles: { emit: vi.fn(), request: vi.fn(async () => ({ huddles: [] })), connected: () => true },
  mapSegment: (s) => ({ id: String(s._id || `${s.speakerId}|${s.startedAt}`), speakerId: s.speakerId, speakerName: s.speakerName, text: s.text, startedAt: s.startedAt }),
  callTranscript: vi.fn(async () => ({ segments: [], text: '' })),
  addTranscriptSegments: vi.fn(async (t, segs) => ({ added: segs.length })),
  uploadRecording: vi.fn(async () => ({ recording: {} })),
  joinMeetingRoom: vi.fn(async () => true),
  leaveMeetingRoom: vi.fn(),
  askAboutMeeting: vi.fn(async () => ({ text: 'You agreed to ship on Friday.' })),
};
vi.mock('../../data/session.js', () => ({
  api: () => adapter,
  useSession: { getState: () => ({ user: { id: 'me', name: 'Mia' }, workspaceId: 'w1' }) },
}));
vi.mock('../../native/index.js', () => ({ isIOS: false }));
const speech = { callbacks: null, stop: vi.fn(async () => {}) };
vi.mock('../../native/speech.js', () => ({
  startCaptions: vi.fn(async (cb) => {
    speech.callbacks = cb;
    return speech.stop;
  }),
}));

const { emit } = await import('../../lib/bus.js');
const { useHuddle } = await import('./huddle.js');
const extras = await import('./callExtras.js');
const { useCallExtras } = extras;
const { recordingNotice } = await import('./callMedia.js');

const tick = () => new Promise((r) => setTimeout(r, 0));
let unbind;

beforeEach(async () => {
  vi.clearAllMocks();
  unbind = extras.bindCallExtras();
  useHuddle.setState({ call: { huddleId: 'meeting-m1', title: 'Standup', scope: {} }, participants: [{ userId: 'me', isLocal: true }, { userId: 'ana' }], muted: false });
  await tick();
  await tick();
});
afterEach(async () => {
  useHuddle.setState({ call: null, participants: [] });
  await tick();
  unbind();
  extras.__resetCallExtras();
});

describe('call extras', () => {
  it('follows a meeting call: joins its room and loads the transcript so far', () => {
    expect(useCallExtras.getState().target).toEqual({ kind: 'meeting', id: 'm1' });
    expect(adapter.joinMeetingRoom).toHaveBeenCalledWith('m1');
    expect(adapter.callTranscript).toHaveBeenCalledWith({ kind: 'meeting', id: 'm1' });
  });

  it('shows the consent banner state when someone else starts recording', () => {
    emit('meeting', {
      event: 'meeting:transcript_segments',
      payload: { meetingId: 'm1', segments: [{ _id: 's1', speakerId: 'ana', speakerName: 'Ana', text: recordingNotice(true, 'Ana'), startedAt: '2026-10-21T10:00:00.000Z' }] },
    });
    expect(useCallExtras.getState().recorder).toMatchObject({ by: 'ana', byName: 'Ana' });
    expect(useCallExtras.getState().consentSeen).toBe(false);
    extras.dismissConsent();
    expect(useCallExtras.getState().consentSeen).toBe(true);
    // Lines for another meeting are ignored.
    emit('meeting', { event: 'meeting:transcript_segments', payload: { meetingId: 'other', segments: [{ _id: 'x', text: 'hi', startedAt: '2026-10-21T10:01:00.000Z' }] } });
    expect(useCallExtras.getState().segments).toHaveLength(1);
  });

  it('captions my speech, sends final lines and ignores them while muted', async () => {
    vi.useFakeTimers();
    try {
      await extras.toggleCallCaptions();
      expect(useCallExtras.getState()).toMatchObject({ showCaptions: true, captions: true });
      speech.callbacks.onPartial('ship it');
      expect(useCallExtras.getState().partial).toBe('ship it');
      speech.callbacks.onFinal({ text: 'ship it on Friday', startedAt: '2026-10-21T10:00:01.000Z', endedAt: '2026-10-21T10:00:03.000Z' });
      useHuddle.setState({ muted: true });
      speech.callbacks.onFinal({ text: 'private aside', startedAt: '2026-10-21T10:00:05.000Z', endedAt: '2026-10-21T10:00:06.000Z' });
      useHuddle.setState({ muted: false });
      await vi.advanceTimersByTimeAsync(2100);
      expect(adapter.addTranscriptSegments).toHaveBeenCalledTimes(1);
      expect(adapter.addTranscriptSegments.mock.calls[0][1]).toEqual([expect.objectContaining({ speakerId: 'me', speakerName: 'Mia', text: 'ship it on Friday' })]);
      // My own line coming back over the socket isn't shown twice.
      emit('meeting', { event: 'meeting:transcript_segments', payload: { meetingId: 'm1', segments: [{ _id: 'srv', speakerId: 'me', speakerName: 'mia', text: 'ship it on Friday', startedAt: '2026-10-21T10:00:01.000Z' }] } });
      expect(useCallExtras.getState().segments).toHaveLength(1);
      await extras.toggleCallCaptions();
      expect(speech.stop).toHaveBeenCalled();
      expect(useCallExtras.getState().showCaptions).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('asks AI with the transcript so far', async () => {
    emit('meeting', { event: 'meeting:transcript_segments', payload: { meetingId: 'm1', segments: [{ _id: 'a', speakerId: 'ana', speakerName: 'Ana', text: 'Ship Friday', startedAt: '2026-10-21T10:00:00.000Z' }] } });
    const res = await extras.askAboutCall('When do we ship?');
    expect(res.text).toMatch(/Friday/);
    expect(adapter.askAboutMeeting).toHaveBeenCalledWith({ workspaceId: 'w1', title: 'Standup', transcript: '[0:00] Ana: Ship Friday', question: 'When do we ship?' });
  });

  describe('recording', () => {
    let recorders;
    beforeEach(() => {
      recorders = [];
      class FakeRecorder {
        static isTypeSupported = (t) => t.startsWith('audio/webm');
        constructor(stream, opts) {
          this.stream = stream;
          this.mimeType = opts?.mimeType || '';
          this.state = 'inactive';
          recorders.push(this);
        }
        start() {
          this.state = 'recording';
        }
        stop() {
          this.state = 'inactive';
          this.ondataavailable?.({ data: new Blob(['abc'], { type: 'audio/webm' }) });
          this.onstop?.();
        }
      }
      class FakeContext {
        resume = async () => {};
        close = async () => {};
        createMediaStreamDestination = () => ({ stream: { id: 'mix' } });
        createMediaStreamSource = () => ({ connect() {}, disconnect() {} });
      }
      window.MediaRecorder = FakeRecorder;
      window.AudioContext = FakeContext;
    });
    afterEach(() => {
      delete window.MediaRecorder;
      delete window.AudioContext;
    });

    it('records, tells everyone, and uploads to the meeting when stopped', async () => {
      await extras.startRecording();
      expect(recorders[0].mimeType).toBe('audio/webm;codecs=opus');
      expect(useCallExtras.getState().recording).toBeTruthy();
      expect(adapter.addTranscriptSegments).toHaveBeenCalledWith({ kind: 'meeting', id: 'm1' }, [expect.objectContaining({ text: expect.stringContaining('[Recording started]') })]);
      await extras.stopRecording();
      expect(adapter.uploadRecording).toHaveBeenCalledTimes(1);
      const [target, blob, opts] = adapter.uploadRecording.mock.calls[0];
      expect(target).toEqual({ kind: 'meeting', id: 'm1' });
      expect(blob.type).toBe('audio/webm');
      expect(opts.fileName).toMatch(/\.webm$/);
      expect(adapter.addTranscriptSegments).toHaveBeenLastCalledWith({ kind: 'meeting', id: 'm1' }, [expect.objectContaining({ text: expect.stringContaining('[Recording stopped]') })]);
      expect(useCallExtras.getState().recording).toBeNull();
    });

    it('uploads when I leave the call while recording, and offers a retry after a failed upload', async () => {
      adapter.uploadRecording.mockRejectedValueOnce(new Error('offline'));
      await extras.startRecording();
      useHuddle.setState({ call: null, participants: [] });
      for (let i = 0; i < 6; i += 1) await tick();
      expect(adapter.uploadRecording).toHaveBeenCalledTimes(1);
      expect(useCallExtras.getState().failedUpload).toBeTruthy();
      extras.retryUpload();
      await tick();
      expect(adapter.uploadRecording).toHaveBeenCalledTimes(2);
    });

    it('explains when the device can’t record', async () => {
      delete window.MediaRecorder;
      expect(extras.recordingUnsupported()).toMatch(/can’t record/);
      await extras.startRecording();
      expect(useCallExtras.getState().recording).toBeNull();
    });
  });
});
