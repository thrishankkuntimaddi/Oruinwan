'use strict';

jest.mock('../../messages/message.model.js', () => ({ updateOne: jest.fn(), findById: jest.fn() }));
jest.mock('../../../features/channels/channel.model.js', () => ({ findById: jest.fn() }));
jest.mock('../../../../models/DMSession', () => ({ findById: jest.fn() }));
jest.mock('../../notifications/notificationService', () => ({ mention: jest.fn(), threadReply: jest.fn() }));
jest.mock('../../../identity', () => ({
    users: { findManyByIds: jest.fn() },
    workspaces: {
        // Everyone in these tests is an active member of the workspace.
        findById: jest.fn(async () => ({ members: new Proxy([], { get: (t, k) => (k === 'some' ? () => true : t[k]) }) })),
    },
}));
jest.mock('../../../features/channels/channelMute.controller', () => ({ canManageChannel: jest.fn() }));
jest.mock('../../../features/presence/presence.service', () => ({ getBulkPresenceAsync: jest.fn() }));

const Message = require('../../messages/message.model.js');
const Channel = require('../../../features/channels/channel.model.js');
const DMSession = require('../../../../models/DMSession');
const notificationService = require('../../notifications/notificationService');
const identity = require('../../../identity');
const { canManageChannel } = require('../../../features/channels/channelMute.controller');
const { getBulkPresenceAsync } = require('../../../features/presence/presence.service');
const { followAndNotify } = require('../threads.service');

const q = (v) => ({ select: () => ({ lean: async () => v }) });
const users = (list) => new Map(list.map((u) => [u._id, u]));

let followers;
beforeEach(() => {
    jest.clearAllMocks();
    followers = ['alice', 'bob', 'carol'];
    Message.updateOne.mockImplementation(async () => ({}));
    Message.findById.mockImplementation(() => q({ followers }));
    Channel.findById.mockImplementation(() => q({ name: 'general', workspace: 'w1', members: [{ user: 'alice' }, { user: 'bob' }, { user: 'carol' }, { user: 'dave' }] }));
    const all = [{ _id: 'alice', username: 'alice' }, { _id: 'bob', username: 'Bob' }, { _id: 'carol', username: 'carol' }, { _id: 'dave', username: 'dave' }];
    identity.users.findManyByIds.mockImplementation(async (ids) => users(all.filter((u) => ids.includes(u._id))));
});

const parent = { _id: 'p1', channel: 'c1', workspace: 'w1', replyCount: 2, sender: 'alice' };

test('@mentions in a thread reply notify the mentioned channel members', async () => {
    await followAndNotify(null, { parent, replierId: 'alice', senderUsername: 'alice', mentionText: 'hey @bob and @dave, also @stranger', replyId: 'r1' });

    const mentioned = notificationService.mention.mock.calls.map(([, a]) => a.mentionedUserId).sort();
    expect(mentioned).toEqual(['bob', 'dave']);
    expect(notificationService.mention).toHaveBeenCalledWith(null, expect.objectContaining({ channelId: 'c1', channelName: 'general', senderUsername: 'alice' }));
    // Mentioned users are not sent the generic reply notification too.
    expect(notificationService.threadReply).toHaveBeenCalledWith(null, expect.objectContaining({ followerIds: ['carol'] }));
    // Mentioned users follow the thread and the reply records its mentions.
    expect(Message.updateOne).toHaveBeenCalledWith({ _id: 'p1' }, { $addToSet: { followers: { $each: ['alice', 'bob', 'dave'] } } });
    expect(Message.updateOne).toHaveBeenCalledWith({ _id: 'r1' }, { $set: { mentions: ['bob', 'dave'] } });
});

test('the replier mentioning themselves is ignored and no mentionText behaves as before', async () => {
    await followAndNotify(null, { parent, replierId: 'bob', senderUsername: 'bob', mentionText: '@bob' });
    expect(notificationService.mention).not.toHaveBeenCalled();
    expect(notificationService.threadReply).toHaveBeenCalledWith(null, expect.objectContaining({ followerIds: ['alice', 'carol'] }));

    jest.clearAllMocks();
    Message.findById.mockImplementation(() => q({ followers }));
    await followAndNotify(null, { parent, replierId: 'alice', senderUsername: 'alice' });
    expect(identity.users.findManyByIds).not.toHaveBeenCalled();
    expect(notificationService.threadReply).toHaveBeenCalledWith(null, expect.objectContaining({ followerIds: ['bob', 'carol'] }));
});

test('DM threads resolve mentions against the participants', async () => {
    DMSession.findById.mockImplementation(() => q({ participants: ['alice', 'bob'], workspace: 'w1' }));
    followers = ['alice'];
    await followAndNotify(null, { parent: { _id: 'p2', dm: 'd1', workspace: 'w1', replyCount: 1 }, replierId: 'alice', senderUsername: 'alice', mentionText: '@bob @dave' });
    expect(notificationService.mention).toHaveBeenCalledTimes(1);
    expect(notificationService.mention).toHaveBeenCalledWith(null, expect.objectContaining({ mentionedUserId: 'bob', dmSessionId: 'd1' }));
    expect(notificationService.threadReply).not.toHaveBeenCalled();
});

describe('@channel / @here in a thread reply', () => {
    const members = [{ user: 'alice' }, { user: 'bob' }, { user: 'carol' }, { user: 'dave' }];
    const channelWith = (extra) => () => q({ name: 'general', workspace: 'w1', members, ...extra });
    const notified = () => notificationService.mention.mock.calls.map(([, a]) => [a.mentionedUserId, !!a.isEveryone]).sort();

    test('@channel notifies every channel member except the replier and muted members, without following', async () => {
        Channel.findById.mockImplementation(channelWith({ mutedBy: [{ user: 'dave' }] }));
        await followAndNotify(null, { parent, replierId: 'alice', senderUsername: 'alice', mentionText: '@channel ship it, @bob', replyId: 'r1' });
        expect(notified()).toEqual([['bob', false], ['carol', true]]);
        // carol is covered by the mention, so she does not also get the generic reply notification
        expect(notificationService.threadReply).not.toHaveBeenCalled();
        expect(Message.updateOne).toHaveBeenCalledWith({ _id: 'p1' }, { $addToSet: { followers: { $each: ['alice', 'bob'] } } });
        expect(Message.updateOne).toHaveBeenCalledWith({ _id: 'r1' }, { $set: { mentions: ['bob'] } });
    });

    test('@here reaches only members who are online', async () => {
        Channel.findById.mockImplementation(channelWith({}));
        getBulkPresenceAsync.mockResolvedValue({ bob: { status: 'online' }, carol: { status: 'offline' }, dave: { status: 'away' } });
        await followAndNotify(null, { parent, replierId: 'alice', senderUsername: 'alice', mentionText: 'standup @here' });
        expect(notified()).toEqual([['bob', true], ['dave', true]]);
        expect(notificationService.threadReply).toHaveBeenCalledWith(null, expect.objectContaining({ followerIds: ['carol'] }));
    });

    test('broadcastMentions "admins": a non-admin replier cannot use @channel; an admin can', async () => {
        Channel.findById.mockImplementation(channelWith({ broadcastMentions: 'admins', admins: ['bob'] }));
        canManageChannel.mockResolvedValue(false);
        await followAndNotify(null, { parent, replierId: 'alice', senderUsername: 'alice', mentionText: '@channel' });
        expect(canManageChannel).toHaveBeenCalledWith(expect.objectContaining({ broadcastMentions: 'admins' }), 'alice');
        expect(notificationService.mention).not.toHaveBeenCalled();
        expect(notificationService.threadReply).toHaveBeenCalledWith(null, expect.objectContaining({ followerIds: ['bob', 'carol'] }));

        jest.clearAllMocks();
        Message.findById.mockImplementation(() => q({ followers }));
        canManageChannel.mockResolvedValue(true);
        await followAndNotify(null, { parent, replierId: 'bob', senderUsername: 'bob', mentionText: '@channel' });
        expect(notified()).toEqual([['alice', true], ['carol', true], ['dave', true]]);
    });

    test('@channel in a DM thread does nothing extra', async () => {
        DMSession.findById.mockImplementation(() => q({ participants: ['alice', 'bob'], workspace: 'w1' }));
        followers = ['alice', 'bob'];
        await followAndNotify(null, { parent: { _id: 'p2', dm: 'd1', workspace: 'w1', replyCount: 1 }, replierId: 'alice', senderUsername: 'alice', mentionText: '@channel' });
        expect(notificationService.mention).not.toHaveBeenCalled();
        expect(notificationService.threadReply).toHaveBeenCalledWith(null, expect.objectContaining({ followerIds: ['bob'] }));
    });
});

test('people who left the channel stop hearing about its threads', async () => {
    // Carol still follows the thread but is no longer a member of the (private) channel.
    Channel.findById.mockImplementation(() => q({ name: 'general', workspace: 'w1', isPrivate: true, members: [{ user: 'alice' }, { user: 'bob' }] }));
    await followAndNotify(null, { parent, replierId: 'alice', senderUsername: 'alice' });
    expect(notificationService.threadReply).toHaveBeenCalledWith(null, expect.objectContaining({ followerIds: ['bob'] }));
});
