import { describe, expect, it } from 'vitest';
import { createDeviceKeys, openMessage, safetyNumber, sealMessage } from '../../../../platform/crypto/privateBox.js';
import { createPrivateChats, memoryStore } from '../../../../platform/crypto/privateChatClient.js';

async function device(userId, deviceId) {
  const keys = await createDeviceKeys();
  return { userId, deviceId, keys, listed: { userId, deviceId, ecdhKey: keys.ecdhPublic, signKey: keys.signPublic } };
}

describe('privateBox', () => {
  it('round-trips for every listed device and nobody else', async () => {
    const ann = await device('ann', 'a1');
    const annPhone = await device('ann', 'a2');
    const bob = await device('bob', 'b1');
    const eve = await device('eve', 'e1');
    const envelope = await sealMessage({ chatId: 'c1', me: ann, devices: [ann.listed, annPhone.listed, bob.listed], content: { t: 'text', text: 'hi Bob' } });

    expect(JSON.stringify(envelope)).not.toContain('hi Bob');
    for (const d of [ann, annPhone, bob]) {
      expect(await openMessage({ chatId: 'c1', envelope, me: d, senderSignKey: ann.listed.signKey })).toEqual({ t: 'text', text: 'hi Bob' });
    }
    await expect(openMessage({ chatId: 'c1', envelope, me: eve, senderSignKey: ann.listed.signKey })).rejects.toMatchObject({ code: 'NOT_FOR_THIS_DEVICE' });
    // Eve can't get in by claiming Bob's device id either: she lacks Bob's private key.
    await expect(openMessage({ chatId: 'c1', envelope, me: { ...eve, deviceId: 'b1' }, senderSignKey: ann.listed.signKey })).rejects.toMatchObject({ code: 'UNREADABLE' });
  });

  it('rejects anything the server changed, rerouted or forged', async () => {
    const ann = await device('ann', 'a1');
    const bob = await device('bob', 'b1');
    const mallory = await device('ann', 'm1'); // a key the server might slip in for Ann
    const envelope = await sealMessage({ chatId: 'c1', me: ann, devices: [ann.listed, bob.listed], content: { text: 'pay 10' } });
    const open = (e, opts = {}) => openMessage({ chatId: 'c1', envelope: e, me: bob, senderSignKey: ann.listed.signKey, ...opts });

    const flip = (b64) => b64.slice(0, 4) + (b64[4] === 'A' ? 'B' : 'A') + b64.slice(5);
    await expect(open({ ...envelope, ct: flip(envelope.ct) })).rejects.toMatchObject({ code: 'BAD_SIGNATURE' });
    await expect(open({ ...envelope, keys: envelope.keys.slice(1) })).rejects.toMatchObject({ code: 'BAD_SIGNATURE' });
    await expect(open(envelope, { chatId: 'c2' })).rejects.toMatchObject({ code: 'BAD_SIGNATURE' }); // moved to another chat
    const forged = await sealMessage({ chatId: 'c1', me: { ...mallory, userId: 'ann', deviceId: 'a1' }, devices: [bob.listed], content: { text: 'pay 1000' } });
    await expect(open(forged)).rejects.toMatchObject({ code: 'BAD_SIGNATURE' });
    expect(await open(envelope)).toEqual({ text: 'pay 10' });
  });

  it('safety numbers are the same on both sides and change with any key', async () => {
    const ann = await device('ann', 'a1');
    const bob = await device('bob', 'b1');
    const bob2 = await device('bob', 'b2');
    const a = await safetyNumber([{ userId: 'ann', devices: [ann.listed] }, { userId: 'bob', devices: [bob.listed] }]);
    const b = await safetyNumber([{ userId: 'bob', devices: [bob.listed] }, { userId: 'ann', devices: [ann.listed] }]);
    expect(a).toBe(b);
    expect(a).toMatch(/^(\d{5} ){11}\d{5}$/);
    expect(await safetyNumber([{ userId: 'ann', devices: [ann.listed] }, { userId: 'bob', devices: [bob.listed, bob2.listed] }])).not.toBe(a);
  });
});

/** A tiny stand-in for /api/private that stores exactly what a real server would see. */
function fakeServer() {
  const devices = [];
  const chats = new Map();
  const messages = [];
  const seenByServer = [];
  const http = (userId) => ({
    async put(path, body) {
      const deviceId = path.split('/').pop();
      seenByServer.push(JSON.stringify(body));
      const old = devices.find((d) => d.deviceId === deviceId);
      if (old && old.ecdhKey !== body.ecdhKey) throw Object.assign(new Error('clash'), { status: 409 });
      if (!old) devices.push({ userId, deviceId, ecdhKey: body.ecdhKey, signKey: body.signKey });
      return { ok: true };
    },
    async get(path, query) {
      if (path === '/devices') return { devices: devices.filter((d) => query.userIds.split(',').includes(d.userId)) };
      const id = path.split('/')[2];
      return { messages: messages.filter((m) => m.chat === id) };
    },
    async post(path, body) {
      seenByServer.push(JSON.stringify(body));
      if (path === '/chats') {
        const id = [userId, body.userId].sort().join('-');
        chats.set(id, { id, participants: [userId, body.userId] });
        return { chat: chats.get(id) };
      }
      const chat = path.split('/')[2];
      const m = { id: `m${messages.length}`, chat, sender: userId, envelope: body.envelope, createdAt: new Date().toISOString() };
      messages.push(m);
      return { message: m };
    },
    async del() { return {}; },
  });
  return { http, seenByServer };
}

describe('private chat client', () => {
  it('two people chat; the server only ever sees ciphertext; a later device cannot read old messages', async () => {
    const server = fakeServer();
    const ann = createPrivateChats({ http: server.http('ann'), userId: 'ann', store: memoryStore() });
    const bob = createPrivateChats({ http: server.http('bob'), userId: 'bob', store: memoryStore() });
    await ann.ensureDevice();
    const chat = await ann.open('w1', 'bob');
    await expect(ann.send(chat, 'too early')).rejects.toMatchObject({ code: 'NO_DEVICES' });

    await bob.ensureDevice();
    await ann.send(chat, 'secret plan');
    expect(server.seenByServer.join('\n')).not.toContain('secret plan');

    const [m] = await bob.messages(chat);
    expect(m).toMatchObject({ mine: false, sender: 'ann', text: 'secret plan' });
    expect((await ann.messages(chat))[0]).toMatchObject({ mine: true, text: 'secret plan' });

    const bobLaptop = createPrivateChats({ http: server.http('bob'), userId: 'bob', store: memoryStore() });
    await bobLaptop.ensureDevice();
    expect((await bobLaptop.messages(chat))[0].error).toMatch(/before this device joined/);

    const sa = await ann.safety(chat);
    const sb = await bob.safety(chat);
    expect(sa.number).toBe(sb.number);
    expect(sa.changed).toBe(false);
  });
});
