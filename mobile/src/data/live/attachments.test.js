// Attachments use the web client's endpoints and message shape, so phone and web can open each
// other's files: upload to /api/v2/uploads, send { type, attachments: [doc] }, load via signed links.
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockApi = { get: vi.fn() };
const mockRefresh = vi.fn();
vi.mock('./http.js', () => ({
  api: mockApi,
  ApiError: class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.status = status;
      this.data = data;
    }
  },
  NETWORK_MESSAGE: 'offline',
  accessToken: () => 'tok',
  refreshSession: (...a) => mockRefresh(...a),
  serverUrl: () => 'https://api.example',
}));
vi.mock('../../native/index.js', () => ({ clientPlatform: 'android' }));

const { attachmentMessageBody, clearMediaCache, mapAttachment, mediaUrl, objectPathOf, uploadFile } = await import('./attachments.js');

// A stand-in XMLHttpRequest answering each send() from a queue of { status, body }.
let replies = [];
let sent = [];
class FakeXhr {
  constructor() {
    this.headers = {};
    this.upload = { addEventListener: (ev, fn) => (this.onProgress = fn) };
  }
  open(method, url) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(k, v) {
    this.headers[k] = v;
  }
  send(body) {
    sent.push({ url: this.url, headers: this.headers, body });
    const r = replies.shift();
    this.onProgress?.({ lengthComputable: true, loaded: 50, total: 100 });
    this.status = r.status;
    this.responseText = JSON.stringify(r.body);
    this.response = this.responseText;
    queueMicrotask(() => this.onload());
  }
  abort() {
    this.onabort?.();
  }
}

const SERVER_ATTACHMENT = {
  url: '/api/v2/uploads/file?path=channels%2F2026-10-20%2Fx.png',
  name: 'photo.png',
  size: 5357,
  sizeFormatted: '5.2 KB',
  mimeType: 'image/png',
  type: 'image',
  gcsPath: 'channels/2026-10-20/x.png',
};

beforeEach(() => {
  vi.clearAllMocks();
  clearMediaCache();
  replies = [];
  sent = [];
  globalThis.XMLHttpRequest = FakeXhr;
});

describe('uploadFile', () => {
  it('posts the file with the conversation and maps the result', async () => {
    replies.push({ status: 200, body: SERVER_ATTACHMENT });
    const progress = [];
    const file = new File(['x'.repeat(10)], 'photo.png', { type: 'image/png' });
    const a = await uploadFile(file, { conversationId: 'c1', conversationType: 'dm', onProgress: (p) => progress.push(p) });

    expect(sent[0].url).toBe('https://api.example/api/v2/uploads');
    expect(sent[0].headers).toMatchObject({ Authorization: 'Bearer tok', 'x-client-platform': 'android' });
    expect(sent[0].body.get('conversationType')).toBe('dm');
    expect(sent[0].body.get('conversationId')).toBe('c1');
    expect(sent[0].body.get('file').name).toBe('photo.png');
    expect(a).toMatchObject({ type: 'image', url: SERVER_ATTACHMENT.url, gcsPath: 'channels/2026-10-20/x.png', name: 'photo.png', mimeType: 'image/png', size: 5357 });
    expect(progress).toEqual([50, 100]);
  });

  it('refreshes an expired session once and retries', async () => {
    replies.push({ status: 401, body: {} }, { status: 200, body: SERVER_ATTACHMENT });
    await uploadFile(new File(['abc'], 'a.png', { type: 'image/png' }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(2);
  });

  it("explains the server's refusals and never uploads blocked files", async () => {
    replies.push({ status: 403, body: { error: 'File sharing is turned off for this workspace' } });
    await expect(uploadFile(new File(['abc'], 'a.txt'))).rejects.toThrow('File sharing is turned off for this workspace');
    await expect(uploadFile(new File(['abc'], 'setup.exe'))).rejects.toMatchObject({ noRetry: true });
    await expect(uploadFile(new File([], 'empty.txt'))).rejects.toThrow(/empty/);
    expect(sent).toHaveLength(1);
  });
});

describe('message bodies', () => {
  it('matches the web client for channels and DMs', () => {
    const a = { ...mapAttachment(SERVER_ATTACHMENT), width: 64, height: 64 };
    expect(attachmentMessageBody({ kind: 'channel', id: 'ch1' }, a, { clientTempId: 't1' })).toEqual({
      type: 'image',
      channelId: 'ch1',
      clientTempId: 't1',
      attachments: [{ type: 'image', url: SERVER_ATTACHMENT.url, name: 'photo.png', size: 5357, mimeType: 'image/png', width: 64, height: 64 }],
    });
    const dm = attachmentMessageBody({ kind: 'dm', id: 'd1' }, { ...a, type: 'voice', duration: 3 }, { workspaceId: 'w1' });
    expect(dm).toMatchObject({ type: 'voice', dmSessionId: 'd1', workspaceId: 'w1', attachments: [{ duration: 3 }] });
  });
});

describe('mediaUrl', () => {
  it('signs stored files once until the link is about to expire', async () => {
    mockApi.get.mockResolvedValue({ url: '/api/v2/uploads/file?path=p&sig=s', expiresAt: new Date(Date.now() + 600_000).toISOString() });
    const a = mapAttachment(SERVER_ATTACHMENT);
    expect(objectPathOf(a)).toBe('channels/2026-10-20/x.png');
    expect(objectPathOf({ url: SERVER_ATTACHMENT.url })).toBe('channels/2026-10-20/x.png');
    const [one, two] = await Promise.all([mediaUrl(a), mediaUrl(a)]);
    expect(one).toBe('https://api.example/api/v2/uploads/file?path=p&sig=s');
    expect(two).toBe(one);
    expect(mockApi.get).toHaveBeenCalledTimes(1);
    expect(mockApi.get).toHaveBeenCalledWith('/v2/uploads/sign', { path: 'channels/2026-10-20/x.png' });
    await mediaUrl(a, { fresh: true });
    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });

  it('uses other URLs as they are', async () => {
    expect(await mediaUrl({ url: 'https://cdn.example/a.png' })).toBe('https://cdn.example/a.png');
    expect(await mediaUrl({ url: '/uploads/legacy.png' })).toBe('https://api.example/uploads/legacy.png');
    expect(await mediaUrl({})).toBeNull();
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});
