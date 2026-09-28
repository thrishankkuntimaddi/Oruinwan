'use strict';

const { MODULES, registerModules, registerModuleSockets } = require('..');

describe('module registry', () => {
  test('every module has a name and a register function', () => {
    for (const mod of MODULES) {
      expect(typeof mod.name).toBe('string');
      expect(typeof mod.register).toBe('function');
    }
  });

  test('modules mount the same public URLs the app has always used, in order', () => {
    const mounts = [];
    const requireAuth = function requireAuth(req, res, next) { next(); };
    const app = { use: (prefix, ...handlers) => mounts.push({ prefix, auth: handlers.includes(requireAuth) }) };
    registerModules({ app, io: null, requireAuth });
    expect(mounts).toEqual([
      { prefix: '/api/v2/messages', auth: false },
      { prefix: '/api/v2/dm', auth: false },
      { prefix: '/api/messages', auth: true },
      { prefix: '/api/threads', auth: false },
      { prefix: '/api/threads/v2', auth: true },
      { prefix: '/api/notifications', auth: false },
      { prefix: '/api/v2/huddles', auth: false },
    ]);
  });

  test('socket registration attaches the huddle handlers', () => {
    const events = [];
    const socket = { id: 's1', user: { id: 'u1' }, data: {}, on: (event) => events.push(event) };
    registerModuleSockets({}, socket);
    expect(events).toEqual(expect.arrayContaining(['huddle:start', 'huddle:join', 'huddle:leave', 'huddle:offer', 'disconnect']));
  });

  test('socket registration attaches the live-meeting handlers', () => {
    const events = [];
    const socket = { id: 's1', user: { id: 'u1' }, data: {}, on: (event) => events.push(event) };
    registerModuleSockets({}, socket);
    expect(events).toEqual(expect.arrayContaining(['meeting:join', 'meeting:leave', 'meeting:notes_update']));
  });
});
