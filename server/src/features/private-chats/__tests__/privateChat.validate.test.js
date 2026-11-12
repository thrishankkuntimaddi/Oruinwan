'use strict';

const { validDeviceKeys, validEnvelope, cleanEnvelope } = require('../privateChat.validate');

const b64 = (n) => Buffer.alloc(n, 7).toString('base64');
const SPKI = b64(91); // P-256 SPKI
const DEV = 'a'.repeat(32);

const envelope = (over = {}) => ({
    v: 1,
    sender: { userId: 'u1', deviceId: DEV },
    eph: SPKI, salt: b64(16), iv: b64(12), ct: b64(40), sig: b64(64),
    keys: [{ d: DEV, iv: b64(12), k: b64(48) }, { d: 'b'.repeat(32), iv: b64(12), k: b64(48) }],
    ...over,
});
const ctx = { userId: 'u1', deviceIds: [DEV] };

describe('private chat validation', () => {
    test('device keys must be P-256 SPKI base64', () => {
        expect(validDeviceKeys({ ecdhKey: SPKI, signKey: SPKI })).toBeNull();
        expect(validDeviceKeys({ ecdhKey: 'nope', signKey: SPKI })).toMatch(/base64/);
        expect(validDeviceKeys({})).toMatch(/base64/);
    });

    test('accepts a well-formed envelope from one of my devices', () => {
        expect(validEnvelope(envelope(), ctx)).toBeNull();
    });

    test('rejects envelopes that claim another sender or an unregistered device', () => {
        expect(validEnvelope(envelope({ sender: { userId: 'u2', deviceId: DEV } }), ctx)).toMatch(/sender must be you/);
        expect(validEnvelope(envelope({ sender: { userId: 'u1', deviceId: 'c'.repeat(32) } }), ctx)).toMatch(/registered device/);
    });

    test('bounds sizes and fields', () => {
        expect(validEnvelope(envelope({ v: 2 }), ctx)).toMatch(/version/);
        expect(validEnvelope(envelope({ ct: b64(70 * 1024) }), ctx)).toMatch(/too long/);
        expect(validEnvelope(envelope({ keys: [] }), ctx)).toMatch(/recipient/);
        expect(validEnvelope(envelope({ keys: Array.from({ length: 41 }, () => ({ d: DEV, iv: b64(12), k: b64(48) })) }), ctx)).toMatch(/recipient/);
        expect(validEnvelope(envelope({ keys: [{ d: 'not-hex', iv: b64(12), k: b64(48) }] }), ctx)).toMatch(/recipient entry/);
        expect(validEnvelope(envelope({ plaintext: 'oops' }), ctx)).toMatch(/unexpected/);
        expect(validEnvelope(null, ctx)).toMatch(/required/);
    });

    test('stores only the known fields', () => {
        const e = envelope();
        e.keys[0].extra = 'x';
        const clean = cleanEnvelope(e);
        expect(Object.keys(clean).sort()).toEqual(['ct', 'eph', 'iv', 'keys', 'salt', 'sender', 'sig', 'v']);
        expect(clean.keys[0]).toEqual({ d: DEV, iv: e.keys[0].iv, k: e.keys[0].k });
    });
});
