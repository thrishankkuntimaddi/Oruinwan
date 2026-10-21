import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/api', () => ({ default: {}, API_BASE: 'https://api.example.com' }));

import { baseMime, canRecord, extensionFor, formatBytes, pickRecorderMime, recordingFileName } from '../features/huddles/capture/recorderMime';
import { getSpeechRecognition, speechErrorInfo, speechSupport } from '../features/huddles/capture/speechSupport';
import { releaseMeetingRoom, retainMeetingRoom, meetingRoomHolders } from '../features/huddles/capture/meetingRoom';
import { captureTarget, meetingTarget, streamUrl } from '../features/huddles/capture/captureApi';

describe('recorder MIME choice', () => {
    const recorder = (supported) => ({ isTypeSupported: (t) => supported.includes(t) });

    it('prefers VP9/Opus WebM for video and Opus WebM for audio', () => {
        const R = recorder(['video/webm;codecs=vp9,opus', 'video/webm', 'audio/webm;codecs=opus']);
        expect(pickRecorderMime(R, { video: true })).toBe('video/webm;codecs=vp9,opus');
        expect(pickRecorderMime(R, { video: false })).toBe('audio/webm;codecs=opus');
    });

    it('falls back to MP4 (Safari) and to the browser default', () => {
        expect(pickRecorderMime(recorder(['audio/mp4']), {})).toBe('audio/mp4');
        expect(pickRecorderMime(recorder([]), { video: true })).toBe('');
        expect(pickRecorderMime(undefined)).toBe('');
    });

    it('labels uploads with a type and extension the server accepts', () => {
        expect(baseMime('video/webm;codecs=vp9,opus')).toBe('video/webm');
        expect(baseMime('', { video: false })).toBe('audio/webm');
        expect(extensionFor('audio/mp4')).toBe('m4a');
        expect(extensionFor('video/mp4')).toBe('mp4');
        expect(extensionFor('audio/webm;codecs=opus')).toBe('webm');
        expect(recordingFileName('video/webm', new Date(2026, 9, 21, 14, 5))).toBe('call-2026-10-21-1405.webm');
    });

    it('detects MediaRecorder and formats sizes', () => {
        expect(canRecord(function Rec() {})).toBe(true);
        expect(canRecord(undefined)).toBe(false);
        expect(formatBytes(1536)).toBe('2 KB');
        expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    });
});

describe('speech recognition support', () => {
    function SR() {}
    it('finds the prefixed constructor', () => {
        expect(getSpeechRecognition({ webkitSpeechRecognition: SR })).toBe(SR);
        expect(getSpeechRecognition({})).toBeNull();
    });

    it('says why captions cannot run', () => {
        expect(speechSupport({ navigator: { userAgent: 'Firefox' } })).toMatchObject({ supported: false });
        expect(speechSupport({ navigator: { userAgent: 'Firefox' } }).reason).toMatch(/Chrome, Edge and Safari/);
        expect(speechSupport({ navigator: { userAgent: 'Mozilla Electron/33.0.0' }, webkitSpeechRecognition: SR }).reason).toMatch(/desktop app/);
        expect(speechSupport({ navigator: { userAgent: 'Chrome' }, webkitSpeechRecognition: SR, isSecureContext: false }).supported).toBe(false);
        expect(speechSupport({ navigator: { userAgent: 'Chrome' }, webkitSpeechRecognition: SR, isSecureContext: true })).toEqual({ supported: true, reason: '' });
    });

    it('treats silence as harmless and blocked access as fatal', () => {
        expect(speechErrorInfo('no-speech').fatal).toBe(false);
        expect(speechErrorInfo('not-allowed').fatal).toBe(true);
        expect(speechErrorInfo('network').message).toMatch(/speech service/);
    });
});

describe('meeting room holders', () => {
    it('only the last holder leaves the room', () => {
        retainMeetingRoom('m1');
        retainMeetingRoom('m1');
        expect(meetingRoomHolders('m1')).toBe(2);
        expect(releaseMeetingRoom('m1')).toBe(false);
        expect(releaseMeetingRoom('m1')).toBe(true);
        expect(meetingRoomHolders('m1')).toBe(0);
    });
});

describe('capture targets', () => {
    it('stores a meeting call on the meeting and other calls on the huddle run', () => {
        expect(captureTarget('meeting-abc')).toMatchObject({ kind: 'meeting', id: 'abc', base: '/api/v2/meetings/abc', query: '' });
        expect(captureTarget('h-1', 's9')).toMatchObject({ kind: 'huddle', base: '/api/v2/huddles/h-1', query: '?sessionId=s9' });
        expect(meetingTarget('m2').base).toBe('/api/v2/meetings/m2');
    });

    it('makes stream URLs absolute', () => {
        expect(streamUrl('/api/v2/meetings/x/recording/stream?sig=1')).toBe('https://api.example.com/api/v2/meetings/x/recording/stream?sig=1');
        expect(streamUrl('https://cdn/x')).toBe('https://cdn/x');
        expect(streamUrl(null)).toBeNull();
    });
});
