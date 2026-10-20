import { fileIconKind, fitBox, formatBytes, formatDuration, messageTypeFor, previewKind, validateUpload } from './files.js';

describe('files', () => {
  it('chooses how a file is shown', () => {
    expect(previewKind({ mimeType: 'image/png', name: 'a.png' })).toBe('image');
    expect(previewKind({ mimeType: 'image/heic', name: 'a.heic' })).toBe('file');
    expect(previewKind({ mimeType: 'image/svg+xml', name: 'a.svg' })).toBe('file');
    expect(previewKind({ mimeType: 'video/mp4' })).toBe('video');
    expect(previewKind({ mimeType: 'audio/webm' })).toBe('audio');
    expect(previewKind({ mimeType: 'application/pdf' })).toBe('pdf');
    expect(previewKind({ name: 'brief.PDF' })).toBe('pdf');
    expect(previewKind({ type: 'voice', name: 'note' })).toBe('audio');
    expect(previewKind({ mimeType: 'text/csv', name: 'b.csv' })).toBe('file');
  });

  it('picks list icons', () => {
    expect(fileIconKind({ mimeType: 'text/csv', name: 'budget.csv' })).toBe('sheet');
    expect(fileIconKind({ name: 'plan.xlsx' })).toBe('sheet');
    expect(fileIconKind({ mimeType: 'text/plain', name: 'notes.txt' })).toBe('doc');
    expect(fileIconKind({ mimeType: 'application/pdf' })).toBe('pdf');
  });

  it('refuses what the server refuses', () => {
    expect(validateUpload({ name: 'a.png', size: 10 })).toBeNull();
    expect(validateUpload({ name: 'empty.txt', size: 0 })).toMatch(/empty/);
    expect(validateUpload({ name: 'big.mov', size: 101 * 1024 * 1024 })).toMatch(/100 MB/);
    expect(validateUpload({ name: 'setup.EXE', size: 10 })).toMatch(/Programs/);
  });

  it('maps attachments to message types the server accepts', () => {
    expect(messageTypeFor({ type: 'image' })).toBe('image');
    expect(messageTypeFor({ type: 'voice' })).toBe('voice');
    expect(messageTypeFor({ type: 'audio' })).toBe('file');
    expect(messageTypeFor({})).toBe('file');
  });

  it('formats sizes, durations and boxes', () => {
    expect(formatBytes(30)).toBe('30 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatDuration(65)).toBe('1:05');
    expect(fitBox(2000, 1000)).toEqual({ width: 240, height: 120 });
    expect(fitBox(500, 2000)).toEqual({ width: 80, height: 280 });
    expect(fitBox(null, null).width).toBe(240);
  });
});
