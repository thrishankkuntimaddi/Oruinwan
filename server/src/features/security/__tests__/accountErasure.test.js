'use strict';

const UID = 'd00000000000000000000001';
const users = {};

jest.mock('../../../../models/User', () => ({
  findById: jest.fn((id) => ({ select: () => ({ lean: async () => users[String(id)] || null }) })),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
}));
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../../models/Task', () => ({
  deleteMany: jest.fn(), updateMany: jest.fn(), find: jest.fn(),
}));
jest.mock('../../../../models/DMSession', () => ({ deleteMany: jest.fn(), updateMany: jest.fn() }));
jest.mock('../../../modules/messages/message.model', () => ({ deleteMany: jest.fn(), updateMany: jest.fn() }));
jest.mock('../../channels/channel.model', () => ({ updateMany: jest.fn().mockResolvedValue({ modifiedCount: 2 }) }));
jest.mock('../../../../models/Workspace', () => ({
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
}));
const privateNotes = [{ _id: 'n1' }];
jest.mock('../../../../models/Note', () => ({
  find: jest.fn(() => ({ select: () => ({ lean: async () => privateNotes }) })),
  deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
}));
jest.mock('../../../models/AIMemory', () => ({ deleteMany: jest.fn().mockResolvedValue({ deletedCount: 3 }) }));
jest.mock('../../../models/AIEmbedding', () => ({ deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }) }));
jest.mock('../../../modules/notifications/notificationPreference.model', () => ({ deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }) }));
jest.mock('../../../models/UserDeviceSession', () => ({ deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }) }));
jest.mock('../../../../models/UserSession', () => ({ deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }) }));
jest.mock('../../../socket/getIO', () => ({ getIO: () => null }));

const User = require('../../../../models/User');
const Task = require('../../../../models/Task');
const DMSession = require('../../../../models/DMSession');
const Message = require('../../../modules/messages/message.model');
const Note = require('../../../../models/Note');
const AIMemory = require('../../../models/AIMemory');
const Channel = require('../../channels/channel.model');
const { eraseAccount, ErasureError } = require('../accountErasure');
const { deleteAccount } = require('../../users/user.controller');

function fakeRes() {
  return {
    statusCode: 200, body: null, cleared: [],
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    clearCookie(name) { this.cleared.push(name); return this; },
  };
}

beforeEach(() => {
  for (const k of Object.keys(users)) delete users[k];
  users[UID] = { _id: UID, userType: 'personal', companyId: null, legalHold: false, personalWorkspace: 'w1', profilePictureGcsPath: null };
});

describe('eraseAccount', () => {
  test('anonymises the user and never deletes other people\'s tasks, DMs or messages', async () => {
    const result = await eraseAccount(UID, {});
    expect(result.erased).toBe(true);

    expect(Task.deleteMany).not.toHaveBeenCalled();
    expect(Task.updateMany).not.toHaveBeenCalled();
    expect(DMSession.deleteMany).not.toHaveBeenCalled();
    expect(Message.deleteMany).not.toHaveBeenCalled();

    const [filter, update] = User.updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: UID });
    expect(update.$set.email).toBe(`deleted_${UID}@deleted.oruinwan.invalid`);
    expect(update.$set.username).toBe('[Deleted User]');
    expect(update.$set).toMatchObject({
      passwordHash: null, emails: [], refreshTokens: [], twoFactorEnabled: false,
      twoFactorSecret: null, ssoId: null, blockedUsers: [], accountStatus: 'removed', isActive: false,
    });
    expect(update.$unset).toMatchObject({ phone: 1, googleId: 1, profilePicture: 1 });

    expect(AIMemory.deleteMany).toHaveBeenCalledWith({ user: UID });
    // Only the user's private notes are deleted, scoped to them as owner.
    expect(Note.find.mock.calls[0][0]).toMatchObject({ owner: UID, isPublic: { $ne: true } });
    expect(Note.deleteMany).toHaveBeenCalledWith({ _id: { $in: ['n1'] }, owner: UID });
    // Removed from member lists.
    expect(Channel.updateMany.mock.calls[0][1]).toEqual({ $pull: { members: { user: UID }, admins: UID } });
  });

  test('refuses company-managed accounts', async () => {
    users[UID].companyId = 'c1';
    await expect(eraseAccount(UID, {})).rejects.toMatchObject({ status: 403, extra: { code: 'COMPANY_MANAGED' } });
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  test('refuses accounts under legal hold', async () => {
    users[UID].legalHold = true;
    users[UID].legalHoldReason = 'Litigation';
    const err = await eraseAccount(UID, {}).catch(e => e);
    expect(err).toBeInstanceOf(ErasureError);
    expect(err.status).toBe(403);
    expect(err.extra.reason).toBe('Litigation');
    expect(User.updateOne).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/users/me delegates to the safe erasure', () => {
  test('erases, clears the auth cookie and responds 200', async () => {
    const res = fakeRes();
    await deleteAccount({ user: { sub: UID }, headers: {}, ip: '127.0.0.1' }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.erased).toBe(true);
    expect(res.cleared).toContain('jwt');
    expect(Task.deleteMany).not.toHaveBeenCalled();
    expect(DMSession.deleteMany).not.toHaveBeenCalled();
  });

  test('company accounts get the managed-by-company 403', async () => {
    users[UID].userType = 'company';
    const res = fakeRes();
    await deleteAccount({ user: { sub: UID }, headers: {} }, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe('Your account is managed by your company. Ask an administrator to remove it.');
  });
});
