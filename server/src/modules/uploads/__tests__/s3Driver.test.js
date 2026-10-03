'use strict';

// The S3 driver is exercised against a mocked client: every call becomes a
// command object we can inspect, and GetObject returns a readable Body.
// (jest.mock factories may only touch variables prefixed "mock".)
const mockS3 = { sent: [], headResponse: null, getBody: null, sendError: null };

jest.mock('@aws-sdk/client-s3', () => {
    const cmd = (name) => function (input) { this.name = name; this.input = input; };
    return {
        S3Client: function () {
            this.send = async (command) => {
                mockS3.sent.push(command);
                if (mockS3.sendError) throw mockS3.sendError;
                if (command.name === 'HeadObject') return mockS3.headResponse;
                if (command.name === 'GetObject') return { Body: mockS3.getBody() };
                return {};
            };
        },
        PutObjectCommand: cmd('PutObject'),
        HeadObjectCommand: cmd('HeadObject'),
        GetObjectCommand: cmd('GetObject'),
        DeleteObjectCommand: cmd('DeleteObject'),
    };
});

const { Readable } = require('stream');

function load() {
    jest.resetModules();
    return require('../upload.service');
}

const read = (stream) => new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString()));
    stream.on('error', reject);
});

describe('S3 storage driver', () => {
    const saved = { ...process.env };
    let svc;

    const sent = mockS3.sent;
    beforeEach(() => {
        sent.length = 0;
        mockS3.sendError = null;
        mockS3.headResponse = { ContentType: 'image/png', ContentLength: 3, Metadata: { originalname: 'a.png', uploadedby: 'u1' } };
        mockS3.getBody = () => Readable.from([Buffer.from('abc')]);
        process.env.S3_ENDPOINT = 'http://localhost:9000';
        process.env.S3_BUCKET = 'test-bucket';
        process.env.S3_ACCESS_KEY = 'k';
        process.env.S3_SECRET_KEY = 's';
        delete process.env.STORAGE_DRIVER;
        svc = load();
    });
    afterAll(() => { process.env = saved; });

    test('driver selection', () => {
        expect(svc.storageDriver({})).toBe('local');
        expect(svc.storageDriver({ S3_ENDPOINT: 'http://x' })).toBe('s3');
        expect(svc.storageDriver({ S3_BUCKET: 'b' })).toBe('s3');
        expect(svc.storageDriver({ STORAGE_DRIVER: 's3' })).toBe('s3');
        expect(svc.storageDriver({ STORAGE_DRIVER: 'local', S3_ENDPOINT: 'http://x' })).toBe('local');
        expect(svc.BUCKET_NAME).toBe('test-bucket');
    });

    test('writeObject sends PutObject with type and string metadata', async () => {
        await svc.writeObject('channels/2026-10-03/x.png', Buffer.from('abc'), {
            contentType: 'image/png',
            metadata: { originalName: 'a.png', uploadedBy: 'u1', companyId: undefined, empty: '' },
        });
        expect(sent).toHaveLength(1);
        expect(sent[0].name).toBe('PutObject');
        expect(sent[0].input).toMatchObject({ Bucket: 'test-bucket', Key: 'channels/2026-10-03/x.png', ContentType: 'image/png' });
        expect(sent[0].input.Metadata).toEqual({ originalName: 'a.png', uploadedBy: 'u1' });
    });

    test('objectHandle reads metadata via HeadObject and streams via GetObject with a Range', async () => {
        const h = svc.objectHandle('dms/f.png');
        const [meta] = await h.getMetadata();
        expect(sent[0]).toMatchObject({ name: 'HeadObject', input: { Bucket: 'test-bucket', Key: 'dms/f.png' } });
        expect(meta).toEqual({ contentType: 'image/png', size: 3, metadata: { originalName: 'a.png', uploadedBy: 'u1' } });

        expect(await read(h.createReadStream({ start: 1, end: 2 }))).toBe('abc');
        expect(sent[1]).toMatchObject({ name: 'GetObject', input: { Bucket: 'test-bucket', Key: 'dms/f.png', Range: 'bytes=1-2' } });

        await read(h.createReadStream());
        expect(sent[2].input.Range).toBeUndefined();
    });

    test('a missing object is a 404, for metadata and for the stream', async () => {
        mockS3.sendError = Object.assign(new Error('nope'), { name: 'NotFound' });
        const h = svc.objectHandle('gone.png');
        await expect(h.getMetadata()).rejects.toMatchObject({ code: 404 });
        await expect(read(h.createReadStream())).rejects.toMatchObject({ code: 404 });
    });

    test('deleteObject sends DeleteObject and ignores NotFound', async () => {
        await svc.deleteObject('voice/v.webm');
        expect(sent[0]).toMatchObject({ name: 'DeleteObject', input: { Bucket: 'test-bucket', Key: 'voice/v.webm' } });
        mockS3.sendError = Object.assign(new Error('nope'), { name: 'NoSuchKey' });
        await expect(svc.deleteObject('voice/v.webm')).resolves.toBeUndefined();
        mockS3.sendError = new Error('boom');
        await expect(svc.deleteObject('voice/v.webm')).rejects.toThrow('boom');
    });

    test('uploadObject stores under <folder>/<date>/<uuid><ext> and keeps the old alias', async () => {
        const file = { originalname: 'photo.JPG', mimetype: 'image/jpeg', size: 3, buffer: Buffer.from('abc') };
        const out = await svc.uploadToGCS(file, 'profiles', { userId: 'u1', companyId: 'c1' });
        expect(svc.uploadToGCS).toBe(svc.uploadObject);
        expect(svc.streamGCSFile).toBe(svc.streamObject);
        expect(out.gcsPath).toMatch(/^profiles\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.JPG$/);
        expect(out.url).toBe(`/api/v2/uploads/file?path=${encodeURIComponent(out.gcsPath)}`);
        expect(out.type).toBe('image');
        expect(sent[0].input.Metadata).toEqual({ originalName: 'photo.JPG', uploadedBy: 'u1', companyId: 'c1' });
    });

    test('metadata keys come back in camelCase although S3 lowercases them', () => {
        const { fromS3Metadata } = require('../upload.service');
        expect(fromS3Metadata({ uploadedby: 'u1', companyid: 'c1', originalname: 'a.txt', custom: 'x' }))
            .toEqual({ uploadedBy: 'u1', companyId: 'c1', originalName: 'a.txt', custom: 'x' });
    });
});
