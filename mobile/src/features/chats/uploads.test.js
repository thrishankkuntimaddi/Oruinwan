// Files sent from a composer: uploaded in parallel, sent in the order they were added, kept on
// screen with Retry when they fail, and removable with Cancel.
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockApi = { uploadAttachment: vi.fn(), sendAttachment: vi.fn() };
vi.mock('../../data/session.js', () => ({ api: () => mockApi }));
vi.mock('../../lib/bus.js', () => ({ toast: vi.fn() }));

const { getQueryData, setQueryData } = await import('../../data/query.js');
const { cancelUpload, retryUpload, sendFiles, uploadsFor } = await import('./uploads.js');
const { toast } = await import('../../lib/bus.js');

const conv = { kind: 'channel', id: 'ch1' };
const KEY = 'messages:ch1';
const tick = () => new Promise((r) => setTimeout(r, 0));
const file = (name, type = 'text/plain') => new File(['hello'], name, { type });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  setQueryData(KEY, { items: [], hasMore: false });
  mockApi.sendAttachment.mockImplementation(async (c, a, { clientTempId }) => ({ id: `saved-${a.name}`, clientTempId, attachments: [a] }));
});

describe('sendFiles', () => {
  it('sends in the order added even when a later upload finishes first', async () => {
    const first = deferred();
    mockApi.uploadAttachment.mockImplementation((c, f) => (f.name === 'a.txt' ? first.promise : Promise.resolve({ name: f.name, type: 'file' })));
    expect(sendFiles({ key: KEY, conv, me: 'u1', files: [file('a.txt'), file('b.txt')] })).toBe(2);
    await tick();
    expect(mockApi.sendAttachment).not.toHaveBeenCalled();
    first.resolve({ name: 'a.txt', type: 'file' });
    await vi.waitFor(() => expect(mockApi.sendAttachment).toHaveBeenCalledTimes(2));
    expect(mockApi.sendAttachment.mock.calls.map((c) => c[1].name)).toEqual(['a.txt', 'b.txt']);
    await vi.waitFor(() => expect(getQueryData(KEY).items.map((m) => m.id)).toEqual(['saved-a.txt', 'saved-b.txt']));
  });

  it('keeps a failed upload for Retry, then sends it', async () => {
    const key = 'messages:ch2';
    setQueryData(key, { items: [] });
    mockApi.uploadAttachment.mockRejectedValueOnce(new Error('Network down')).mockResolvedValueOnce({ name: 'c.txt', type: 'file' });
    sendFiles({ key, conv: { kind: 'channel', id: 'ch2' }, me: 'u1', files: [file('c.txt')] });
    await vi.waitFor(() => expect(uploadsFor(key)[0]).toMatchObject({ failed: true, pending: false, error: 'Network down' }));
    expect(mockApi.sendAttachment).not.toHaveBeenCalled();

    retryUpload(uploadsFor(key)[0].id);
    await vi.waitFor(() => expect(uploadsFor(key)).toHaveLength(0));
    expect(getQueryData(key).items.map((m) => m.id)).toEqual(['saved-c.txt']);
  });

  it('refuses files the server would refuse, without uploading', () => {
    expect(sendFiles({ key: KEY, conv, me: 'u1', files: [new File([], 'empty.txt'), file('setup.exe')] })).toBe(0);
    expect(toast).toHaveBeenCalledTimes(2);
    expect(mockApi.uploadAttachment).not.toHaveBeenCalled();
  });

  it('passes the thread and stops on Cancel', async () => {
    const key = 'thread:p1';
    const pending = deferred();
    let signal;
    mockApi.uploadAttachment.mockImplementation((c, f, opts) => {
      signal = opts.signal;
      return pending.promise;
    });
    sendFiles({ key, conv, threadOf: 'p1', me: 'u1', files: [file('d.png', 'image/png')] });
    const [item] = uploadsFor(key);
    expect(item).toMatchObject({ parentId: 'p1', pending: true, attachments: [{ type: 'image', name: 'd.png' }], upload: { progress: 0 } });

    mockApi.uploadAttachment.mock.calls[0][2].onProgress(50);
    expect(uploadsFor(key)[0].upload.progress).toBe(50);

    cancelUpload(item.id);
    expect(signal.aborted).toBe(true);
    expect(uploadsFor(key)).toHaveLength(0);
    pending.resolve({ name: 'd.png', type: 'image' });
    await tick();
    expect(mockApi.sendAttachment).not.toHaveBeenCalled();
  });
});
