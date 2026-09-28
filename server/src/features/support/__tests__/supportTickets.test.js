'use strict';

jest.mock('../../../../models/SupportMessage', () => ({ create: jest.fn(), find: jest.fn() }));
const mockStore = {};
jest.mock('../../../../models/SupportTicket', () => ({
  findById: jest.fn((id) => {
    const doc = mockStore[id] || null;
    // adminUpdate awaits findById directly; getTicket chains populate/lean.
    const chain = { populate: () => chain, lean: async () => (doc ? { ...doc, messages: [...doc.messages] } : null), then: (r, j) => Promise.resolve(doc).then(r, j) };
    return chain;
  }),
}));

const SupportMessage = require('../../../../models/SupportMessage');
const { buildThread, adminUpdate } = require('../supportTickets.service');

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

describe('adminUpdate on a personal-account ticket (companyId null)', () => {
  test('stores the reply on the ticket and does not emit to a company room', async () => {
    const ticket = {
      _id: 'p1', companyId: null, creatorId: 'u9', subject: 'Help', description: 'Hi', status: 'open', messages: [],
      async save() { return this; },
    };
    mockStore.p1 = ticket;
    SupportMessage.find.mockReturnValue({ populate: () => ({ sort: () => ({ lean: async () => [] }) }) });
    const io = { to: jest.fn(() => ({ emit: jest.fn() })) };

    const result = await adminUpdate('p1', { message: 'We are looking into it', adminId: 'admin1', io });

    expect(SupportMessage.create).not.toHaveBeenCalled();
    expect(ticket.status).toBe('in-progress');
    expect(ticket.messages[0]).toMatchObject({ sender: 'admin1', content: 'We are looking into it', isFromAdmin: true });
    expect(io.to).not.toHaveBeenCalled();
    expect(result.messages.map((m) => [m.message, m.senderRole])).toEqual([['We are looking into it', 'platform']]);
  });
});
