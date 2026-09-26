'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { PassThrough } = require('stream');

describe('local upload storage', () => {
  let dir;
  let svc;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oruinwan-uploads-'));
    process.env.STORAGE_DRIVER = 'local';
    process.env.LOCAL_UPLOAD_DIR = dir;
    jest.resetModules();
    svc = require('../upload.service');
  });
  afterAll(() => {
    delete process.env.STORAGE_DRIVER;
    delete process.env.LOCAL_UPLOAD_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function fakeRes() {
    const res = new PassThrough();
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.headers = null;
    res.writeHead = (status, headers) => { res.statusCode = status; res.headers = headers; };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; res.end(); return res; };
    res.done = new Promise((r) => res.on('finish', () => r(Buffer.concat(chunks))));
    return res;
  }

  test('driver selection', () => {
    expect(svc.storageDriver({})).toBe('local');
    expect(svc.storageDriver({ GOOGLE_APPLICATION_CREDENTIALS: '/k.json' })).toBe('gcs');
    expect(svc.storageDriver({ STORAGE_DRIVER: 'local', GOOGLE_APPLICATION_CREDENTIALS: '/k.json' })).toBe('local');
  });

  test('upload then stream back with safe headers, owner metadata and ranges', async () => {
    const file = { originalname: 'notes.txt', mimetype: 'text/plain', size: 11, buffer: Buffer.from('hello world') };
    const att = await svc.uploadToGCS(file, 'dms', { userId: 'u1' });
    expect(att).toMatchObject({ name: 'notes.txt', type: 'file', size: 11 });
    expect(att.url).toBe(`/api/v2/uploads/file?path=${encodeURIComponent(att.gcsPath)}`);

    let seenMeta;
    const res = fakeRes();
    await svc.streamGCSFile(att.gcsPath, { headers: {} }, res, { authorize: async (m) => { seenMeta = m; return true; } });
    expect((await res.done).toString()).toBe('hello world');
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Disposition']).toMatch(/^attachment;/);
    expect(seenMeta).toMatchObject({ uploadedBy: 'u1', originalName: 'notes.txt' });

    const ranged = fakeRes();
    await svc.streamGCSFile(att.gcsPath, { headers: { range: 'bytes=6-10' } }, ranged, {});
    expect((await ranged.done).toString()).toBe('world');
    expect(ranged.statusCode).toBe(206);
  });

  test('authorization failure streams nothing', async () => {
    const att = await svc.uploadToGCS({ originalname: 'a.png', mimetype: 'image/png', size: 3, buffer: Buffer.from('png') }, 'channels', {});
    const res = fakeRes();
    await svc.streamGCSFile(att.gcsPath, { headers: {} }, res, { authorize: async () => false });
    expect(res.statusCode).toBe(403);
  });

  test('paths cannot escape the upload directory', () => {
    expect(() => svc.objectHandle('../../etc/passwd')).toThrow(/Invalid path/);
  });
});
