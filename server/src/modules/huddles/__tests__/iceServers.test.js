'use strict';

const crypto = require('crypto');

jest.mock('axios', () => ({ post: jest.fn() }));
const axios = require('axios');
const { buildIceConfig, coturnCredentials, turnMode, DEFAULT_STUN } = require('../iceServers');

describe('buildIceConfig', () => {
  test('STUN only by default, and says so', async () => {
    const cfg = await buildIceConfig('u1', {});
    expect(cfg.iceServers).toEqual([{ urls: DEFAULT_STUN }]);
    expect(cfg.turn).toBe(false);
    expect(cfg.iceTransportPolicy).toBe('all');
  });

  test('static TURN credentials', async () => {
    const cfg = await buildIceConfig('u1', {
      TURN_URLS: 'turn:turn.example.com:3478, turns:turn.example.com:5349',
      TURN_USERNAME: 'user', TURN_CREDENTIAL: 'pass', STUN_URLS: 'stun:stun.example.com:3478',
    });
    expect(turnMode({ TURN_URLS: 'turn:x', TURN_USERNAME: 'u', TURN_CREDENTIAL: 'p' })).toBe('static');
    expect(cfg.iceServers).toEqual([
      { urls: ['stun:stun.example.com:3478'] },
      { urls: ['turn:turn.example.com:3478', 'turns:turn.example.com:5349'], username: 'user', credential: 'pass' },
    ]);
    expect(cfg.turn).toBe(true);
  });

  test('coturn shared-secret credentials follow the TURN REST scheme', async () => {
    const now = 1_700_000_000_000;
    const cfg = await buildIceConfig('u42', { TURN_URLS: 'turn:t:3478', TURN_SECRET: 's3cret', TURN_TTL_SECONDS: '600' }, now);
    const turn = cfg.iceServers[1];
    expect(turn.username).toBe(`${now / 1000 + 600}:u42`);
    expect(turn.credential).toBe(crypto.createHmac('sha1', 's3cret').update(turn.username).digest('base64'));
    expect(coturnCredentials('s3cret', 'u42', 600, now)).toEqual({ username: turn.username, credential: turn.credential });
  });

  test('Cloudflare TURN (object and array response shapes)', async () => {
    const env = { CLOUDFLARE_TURN_KEY_ID: 'kid', CLOUDFLARE_TURN_API_TOKEN: 'tok' };
    axios.post.mockResolvedValueOnce({ data: { iceServers: { urls: ['turn:turn.cloudflare.com:3478'], username: 'x', credential: 'y' } } });
    let cfg = await buildIceConfig('u1', env);
    expect(axios.post).toHaveBeenCalledWith(
      'https://rtc.live.cloudflare.com/v1/turn/keys/kid/credentials/generate',
      { ttl: 86400 },
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) })
    );
    expect(cfg.turn).toBe(true);

    axios.post.mockResolvedValueOnce({ data: { iceServers: [{ urls: 'turns:turn.cloudflare.com:5349', username: 'x', credential: 'y' }] } });
    cfg = await buildIceConfig('u1', env);
    expect(cfg.iceServers[1].urls).toBe('turns:turn.cloudflare.com:5349');
  });

  test('a TURN provider failure falls back to STUN instead of failing the call', async () => {
    axios.post.mockRejectedValueOnce(new Error('503'));
    const cfg = await buildIceConfig('u1', { CLOUDFLARE_TURN_KEY_ID: 'k', CLOUDFLARE_TURN_API_TOKEN: 't' });
    expect(cfg.turn).toBe(false);
    expect(cfg.iceServers).toHaveLength(1);
  });

  test('relay policy only applies when a TURN server exists', async () => {
    expect((await buildIceConfig('u', { ICE_TRANSPORT_POLICY: 'relay' })).iceTransportPolicy).toBe('all');
    const withTurn = await buildIceConfig('u', { ICE_TRANSPORT_POLICY: 'relay', TURN_URLS: 'turn:t', TURN_USERNAME: 'a', TURN_CREDENTIAL: 'b' });
    expect(withTurn.iceTransportPolicy).toBe('relay');
  });
});
