'use strict';

const { buildThread } = require('../supportTickets.service');

describe('buildThread', () => {
  const creator = { _id: 'u1', username: 'alice' };
  const admin = { _id: 'a1', username: 'admin' };
  const ticket = { _id: 't1', creatorId: creator, description: 'Printer on fire', messages: [] };

  test('drops the auto-created first message that repeats the description', () => {
    const thread = buildThread(ticket, [
      { _id: 'm1', sender: creator, content: 'Printer on fire', senderRole: 'company', createdAt: '2026-01-01T10:00:00Z' },
      { _id: 'm2', sender: admin, content: 'On it', senderRole: 'platform', createdAt: '2026-01-01T10:05:00Z' },
    ]);
    expect(thread).toEqual([{ _id: 'm2', sender: admin, message: 'On it', senderRole: 'platform', createdAt: '2026-01-01T10:05:00Z' }]);
  });

  test('keeps a first message that differs from the description', () => {
    const thread = buildThread(ticket, [
      { _id: 'm1', sender: creator, content: 'Hello?', senderRole: 'company', createdAt: '2026-01-01T10:00:00Z' },
    ]);
    expect(thread.map((m) => m.message)).toEqual(['Hello?']);
  });

  test('merges legacy embedded messages in time order', () => {
    const legacy = {
      ...ticket,
      messages: [
        { _id: 'e1', sender: admin, content: 'Legacy admin note', isFromAdmin: true, createdAt: '2026-01-01T10:03:00Z' },
        { _id: 'e2', sender: creator, message: 'Legacy field name', createdAt: '2026-01-01T10:10:00Z' },
      ],
    };
    const thread = buildThread(legacy, [
      { _id: 'm2', sender: admin, content: 'On it', senderRole: 'platform', createdAt: '2026-01-01T10:05:00Z' },
    ]);
    expect(thread.map((m) => [m.message, m.senderRole])).toEqual([
      ['Legacy admin note', 'platform'],
      ['On it', 'platform'],
      ['Legacy field name', 'company'],
    ]);
  });
});
