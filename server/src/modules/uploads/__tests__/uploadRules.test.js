'use strict';

// Upload rules: filename encoding, blocked types, error mapping, attachment typing,
// and the attachments a message may carry.

const { fixFilenameEncoding, isBlockedFile, uploadErrorResponse, MAX_FILE_SIZE } = require('../upload.controller');
const { resolveAttachmentType } = require('../upload.service');

describe('upload controller rules', () => {
  test('UTF-8 filenames decoded as latin1 by the multipart parser are repaired', () => {
    const utf8AsLatin1 = Buffer.from('notes ünïcødé 名前.txt', 'utf8').toString('latin1');
    expect(fixFilenameEncoding(utf8AsLatin1)).toBe('notes ünïcødé 名前.txt');
    expect(fixFilenameEncoding('plain name.pdf')).toBe('plain name.pdf');
    expect(fixFilenameEncoding('already ü.txt')).toBe('already ü.txt'); // not valid UTF-8 bytes: kept
    expect(fixFilenameEncoding('名前.txt')).toBe('名前.txt'); // real unicode: kept
  });

  test('programs are refused by MIME type or extension', () => {
    expect(isBlockedFile({ mimetype: 'application/x-msdownload', originalname: 'a.bin' })).toBe(true);
    expect(isBlockedFile({ mimetype: 'application/octet-stream', originalname: 'setup.EXE' })).toBe(true);
    expect(isBlockedFile({ mimetype: 'application/octet-stream', originalname: 'run.bat' })).toBe(true);
    expect(isBlockedFile({ mimetype: 'application/pdf', originalname: 'report.pdf' })).toBe(false);
    expect(isBlockedFile({ mimetype: 'text/javascript', originalname: 'app.js' })).toBe(false);
  });

  test('upload errors become 413 / 415 instead of 500', () => {
    const [s1, b1] = uploadErrorResponse({ code: 'LIMIT_FILE_SIZE' });
    expect(s1).toBe(413);
    expect(b1.error).toMatch(/100 MB/);
    expect(b1.maxBytes).toBe(MAX_FILE_SIZE);
    expect(uploadErrorResponse({ code: 'FILE_TYPE_BLOCKED' })[0]).toBe(415);
    expect(uploadErrorResponse(new Error('other'))).toBeNull();
  });

  test('images browsers cannot draw are shared as files', () => {
    expect(resolveAttachmentType('image/png')).toBe('image');
    expect(resolveAttachmentType('image/jpeg')).toBe('image');
    expect(resolveAttachmentType('image/heic')).toBe('file');
    expect(resolveAttachmentType('image/svg+xml')).toBe('file');
    expect(resolveAttachmentType('image/tiff')).toBe('file');
    expect(resolveAttachmentType('audio/webm')).toBe('voice');
    expect(resolveAttachmentType('video/mp4')).toBe('video');
    expect(resolveAttachmentType('application/pdf')).toBe('file');
  });
});

describe('message attachment sanitizer', () => {
  let sanitizeAttachments;
  let objectPathOf;
  const meta = { size: 1234, contentType: 'image/png', metadata: { uploadedBy: 'u1' } };
  const canAccessFile = jest.fn();

  beforeAll(() => {
    jest.resetModules();
    jest.doMock('../upload.service', () => ({
      objectHandle: (p) => ({
        getMetadata: async () => {
          if (p.includes('missing')) throw Object.assign(new Error('nf'), { code: 404 });
          return [meta];
        },
      }),
    }));
    jest.doMock('../upload.access', () => ({ canAccessFile }));
    ({ sanitizeAttachments, objectPathOf } = require('../attachmentSanitizer'));
  });
  afterAll(() => {
    jest.dontMock('../upload.service');
    jest.dontMock('../upload.access');
  });

  const url = (p) => `/api/v2/uploads/file?path=${encodeURIComponent(p)}`;

  test('only upload proxy paths are accepted', () => {
    expect(objectPathOf(url('channels/2026-09-28/a.png'))).toBe('channels/2026-09-28/a.png');
    expect(objectPathOf('https://evil.example/x.png')).toBeNull();
    expect(objectPathOf(url('../etc/passwd'))).toBeNull();
    expect(objectPathOf(`${url('a.png')}&u=1`)).toBeNull();
  });

  test('keeps known fields, takes size from storage, drops the rest', async () => {
    canAccessFile.mockResolvedValue(true);
    const out = await sanitizeAttachments([{
      type: 'voice', url: url('voice/2026-09-28/v.webm'), name: 'v.webm', size: 1, mimeType: 'audio/webm',
      duration: 7, width: 'x', variant: 'bogus', evil: '<script>', gcsPath: 'voice/2026-09-28/v.webm',
    }], 'u1');
    expect(out).toEqual([{ type: 'voice', url: url('voice/2026-09-28/v.webm'), name: 'v.webm', size: 1234, mimeType: 'audio/webm', duration: 7 }]);
  });

  test('refuses foreign URLs, unknown types, missing files and files the sender cannot read', async () => {
    canAccessFile.mockResolvedValue(true);
    await expect(sanitizeAttachments([{ type: 'image', url: 'javascript:alert(1)' }], 'u1')).rejects.toMatchObject({ status: 400 });
    await expect(sanitizeAttachments([{ type: 'exe', url: url('a/b.png') }], 'u1')).rejects.toMatchObject({ status: 400 });
    await expect(sanitizeAttachments([{ type: 'image', url: url('a/missing.png') }], 'u1')).rejects.toMatchObject({ status: 400 });
    await expect(sanitizeAttachments('nope', 'u1')).rejects.toMatchObject({ status: 400 });
    await expect(sanitizeAttachments(Array(11).fill({ type: 'image', url: url('a/b.png') }), 'u1')).rejects.toMatchObject({ status: 400 });
    canAccessFile.mockResolvedValue(false);
    await expect(sanitizeAttachments([{ type: 'image', url: url('a/b.png') }], 'u2')).rejects.toMatchObject({ status: 403 });
  });

  test('no attachments is fine', async () => {
    expect(await sanitizeAttachments(undefined, 'u1')).toEqual([]);
    expect(await sanitizeAttachments([], 'u1')).toEqual([]);
  });
});
