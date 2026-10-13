// @vitest-environment jsdom
// The demo workspace (desktop and tablet apps): the in-app backend answers in the server's
// shapes, and its messages go through the client's real end-to-end decryption.
import { vi } from 'vitest';

vi.mock('../appMode/env', async (importOriginal) => ({ ...(await importOriginal()), isDemoMode: () => true }));

const { demoRequest, resetDemo } = await import('../appMode/demo/backend');
const { WORKSPACE_ID } = await import('../appMode/demo/seed');
const { batchDecryptMessages } = await import('../services/messageEncryptionService');
const { normalizeMessage } = await import('../hooks/conversationUtils');

const get = (path, query = '') => demoRequest('GET', path, new URLSearchParams(query), null);

describe('demo backend', () => {
  beforeEach(() => resetDemo());

  test('one workspace with people, channels and DMs', async () => {
    const { data: { workspaces } } = await get('/api/workspaces/my');
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].id).toBe(WORKSPACE_ID);
    expect((await get(`/api/workspaces/${WORKSPACE_ID}/members`)).data.members.length).toBeGreaterThan(5);
    const { data: { channels } } = await get(`/api/workspaces/${WORKSPACE_ID}/channels`);
    expect(channels.map((c) => c.name)).toContain('engineering');
    expect(channels.every((c) => /^[a-f0-9]{24}$/.test(c._id))).toBe(true);
    expect((await get(`/api/v2/messages/workspace/${WORKSPACE_ID}/dms`)).data.sessions.length).toBe(4);
  });

  test('channel messages decrypt with the client\'s own code', async () => {
    const { data: { channels } } = await get(`/api/workspaces/${WORKSPACE_ID}/channels`);
    const eng = channels.find((c) => c.name === 'engineering');
    const { data: { messages } } = await get(`/api/v2/messages/channel/${eng._id}`, 'limit=50');
    expect(messages.every((m) => m.payload.isEncrypted && m.payload.ciphertext)).toBe(true);
    const decrypted = await batchDecryptMessages(messages.map(normalizeMessage), eng._id, 'channel');
    expect(decrypted.map((m) => m.decryptedContent)).toContain('Staging is green again. The flaky socket test was a race in the reconnect handler.');
  });

  test('sending, threads, tasks and notes', async () => {
    const { data: { channels } } = await get(`/api/workspaces/${WORKSPACE_ID}/channels`);
    const eng = channels.find((c) => c.name === 'engineering');
    const sent = await demoRequest('POST', '/api/v2/messages/channel', null, { channelId: eng._id, ciphertext: 'abc', messageIv: 'def' });
    expect(sent.status).toBe(201);
    const after = (await get(`/api/v2/messages/channel/${eng._id}`)).data.messages;
    expect(after.at(-1).payload.ciphertext).toBe('abc');

    const parent = after.find((m) => m.replyCount === 3);
    const thread = (await get(`/api/v2/messages/thread/${parent._id}`)).data;
    expect(thread.replies).toHaveLength(3);

    const created = await demoRequest('POST', '/api/v2/tasks', null, { title: 'Try the demo', assignmentType: 'self' });
    const task = created.data.tasks[0];
    await demoRequest('PUT', `/api/v2/tasks/${task._id}`, null, { status: 'done' });
    expect((await get(`/api/v2/tasks/${task._id}`)).data.task.status).toBe('done');

    const note = (await demoRequest('POST', '/api/v2/notes', null, { title: 'Ideas', content: '[]' })).data.note;
    expect((await get('/api/v2/notes')).data.notes[0]._id).toBe(note._id);
  });

  test('unknown endpoints answer with empty lists', async () => {
    const { status, data } = await get('/api/some/new/thing');
    expect(status).toBe(200);
    expect(data.items).toEqual([]);
  });
});
