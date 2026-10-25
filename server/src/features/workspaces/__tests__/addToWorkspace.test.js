'use strict';

// Every way into a workspace puts the person in its default channels (#general and the ones
// admins chose), and anyone who was added without them gets them the next time their app loads.

const WS = '64b000000000000000000001';
const ME = '64b0000000000000000000a1';
const OTHER = '64b0000000000000000000b2';

const mockState = { workspace: null, channels: [] };
const mockAddMember = jest.fn(async () => {});
const mockDistribute = jest.fn(async () => true);

jest.mock('../../../identity', () => ({
  workspaces: { findById: jest.fn(async () => mockState.workspace), addMember: (...a) => mockAddMember(...a) },
}));
jest.mock('../../channels/channel.model', () => ({
  find: jest.fn(async (q) => mockState.channels.filter((c) => {
    if (q.isDefault && !c.isDefault) return false;
    if (q.isArchived && c.isArchived) return false;
    if (q['members.user']?.$ne) return !c.members.some((m) => String(m.user) === String(q['members.user'].$ne));
    return true;
  })),
}));
jest.mock('../../../modules/conversations/conversationKeys.service', () => ({
  hasConversationKeys: jest.fn(async () => true),
  distributeKeyToNewMember: (...a) => mockDistribute(...a),
}));

const { addUserToWorkspace, joinMissingDefaultChannels } = require('../addToWorkspace');

const channel = (name, { isDefault = true, members = [] } = {}) => ({
  _id: `ch-${name}`, name, isDefault, isArchived: false,
  members: members.map((user) => ({ user, joinedAt: new Date(0) })),
  save: jest.fn(async () => {}),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockState.workspace = { _id: WS, members: [{ user: OTHER, role: 'owner', status: 'active' }] };
  mockState.channels = [channel('general', { members: [OTHER] }), channel('launch', { members: [OTHER] }), channel('secret', { isDefault: false, members: [OTHER] })];
});

test('joining puts the person in every default channel (and only those) with the channel keys', async () => {
  await addUserToWorkspace(WS, ME);
  expect(mockAddMember).toHaveBeenCalledWith(WS, ME, { role: 'member' });
  const joined = mockState.channels.filter((c) => c.members.some((m) => m.user === ME)).map((c) => c.name);
  expect(joined).toEqual(['general', 'launch']);
  expect(mockDistribute).toHaveBeenCalledWith('ch-general', 'channel', ME);
});

test('someone who was removed is added back as an active member', async () => {
  mockState.workspace.members.push({ user: ME, role: 'member', status: 'removed' });
  await addUserToWorkspace(WS, ME);
  expect(mockAddMember).toHaveBeenCalledWith(WS, ME, { role: 'member' });
});

test('an active member keeps their membership; only the missing default channels are joined', async () => {
  mockState.workspace.members.push({ user: ME, role: 'admin', status: 'active' });
  mockState.channels[0].members.push({ user: ME, joinedAt: new Date(0) });
  const joined = await joinMissingDefaultChannels(WS, ME);
  expect(joined).toBe(1);
  expect(mockAddMember).not.toHaveBeenCalled();
  expect(mockState.channels[1].members.map((m) => m.user)).toContain(ME);
  expect(mockState.channels[0].save).not.toHaveBeenCalled();
});

test('nothing to do is cheap and changes nothing', async () => {
  for (const c of mockState.channels) c.members.push({ user: ME, joinedAt: new Date(0) });
  expect(await joinMissingDefaultChannels(WS, ME)).toBe(0);
  expect(mockDistribute).not.toHaveBeenCalled();
});
