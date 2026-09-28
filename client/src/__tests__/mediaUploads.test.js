import { describe, it, expect, vi } from 'vitest';

vi.mock('@services/api', () => ({ default: { post: vi.fn(), get: vi.fn() }, API_BASE: 'http://api' }));

import { validateUpload, describeUploadError, formatBytes, isNonDisplayableImage, MAX_UPLOAD_BYTES } from '../utils/uploadFile';
import { extensionForMime, baseMime, describeMediaError, formatClock } from '../utils/mediaRecording';

const fakeFile = (name, size, type = '') => ({ name, size, type });

describe('upload checks (same rules as the server)', () => {
    it('refuses empty, oversized and program files with a readable reason', () => {
        expect(validateUpload(fakeFile('a.png', 10, 'image/png'))).toBeNull();
        expect(validateUpload(fakeFile('empty.txt', 0))).toMatch(/empty/);
        expect(validateUpload(fakeFile('big.mov', MAX_UPLOAD_BYTES + 1))).toMatch(/limit is 100 MB/);
        expect(validateUpload(fakeFile('setup.EXE', 10))).toMatch(/Programs and installers/);
        expect(validateUpload(fakeFile('script.js', 10))).toBeNull();
    });

    it('explains server and network failures', () => {
        expect(describeUploadError({ response: { status: 413, data: { error: 'File too large (max 100 MB)' } } })).toBe('File too large (max 100 MB)');
        expect(describeUploadError({ response: { status: 415, data: {} } })).toMatch(/not allowed/);
        expect(describeUploadError({ response: { status: 403, data: { message: 'This feature is turned off in this workspace.' } } })).toMatch(/turned off/);
        expect(describeUploadError({ code: 'ERR_NETWORK' })).toMatch(/Network error/);
        expect(describeUploadError({ name: 'CanceledError' })).toBe('Cancelled');
    });

    it('formats sizes and spots images browsers cannot show', () => {
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(2048)).toBe('2.0 KB');
        expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
        expect(isNonDisplayableImage(fakeFile('IMG_1.HEIC', 1, 'image/heic'))).toBe(true);
        expect(isNonDisplayableImage(fakeFile('logo.svg', 1, 'image/svg+xml'))).toBe(true);
        expect(isNonDisplayableImage(fakeFile('a.jpg', 1, 'image/jpeg'))).toBe(false);
    });
});

describe('recording helpers', () => {
    it('maps recorder formats to file extensions', () => {
        expect(extensionForMime('audio/webm;codecs=opus')).toBe('webm');
        expect(extensionForMime('audio/mp4')).toBe('m4a');
        expect(extensionForMime('video/mp4;codecs=avc1')).toBe('mp4');
        expect(extensionForMime('audio/ogg;codecs=opus')).toBe('ogg');
        expect(baseMime('audio/webm;codecs=opus')).toBe('audio/webm');
    });

    it('explains microphone/camera problems', () => {
        expect(describeMediaError({ name: 'NotAllowedError' }, 'microphone')).toMatch(/Microphone access is blocked/);
        expect(describeMediaError({ name: 'NotFoundError' }, 'camera')).toMatch(/No camera found/);
        expect(describeMediaError({ name: 'NotReadableError' }, 'microphone')).toMatch(/in use/);
    });

    it('formats clock times', () => {
        expect(formatClock(0)).toBe('0:00');
        expect(formatClock(65.4)).toBe('1:05');
        expect(formatClock(300)).toBe('5:00');
    });
});
