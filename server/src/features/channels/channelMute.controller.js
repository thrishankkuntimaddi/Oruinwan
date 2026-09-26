'use strict';

const Channel = require('./channel.model');
const { recordAdminAction } = require('../../shared/adminAudit');

function isActualMember(channel, userId) {
    return (channel.members || []).some((m) => String(m?.user?._id || m?.user || m) === String(userId));
}

async function loadForMember(req, res) {
    const channel = await Channel.findById(req.params.id).select('members mutedBy admins workspace postingPolicy broadcastMentions');
    if (!channel || !isActualMember(channel, req.user.sub)) {
        res.status(404).json({ message: 'Channel not found' });
        return null;
    }
    return channel;
}

const mutedByUser = (channel, userId) => (channel.mutedBy || []).some((m) => String(m.user) === String(userId));

exports.getMute = async (req, res, next) => {
    try {
        const channel = await loadForMember(req, res);
        if (!channel) return;
        res.json({
            isMuted: mutedByUser(channel, req.user.sub),
            postingPolicy: channel.postingPolicy || 'everyone',
            broadcastMentions: channel.broadcastMentions || 'everyone',
            canManage: await canManage(channel, req.user.sub),
        });
    } catch (err) { next(err); }
};

exports.mute = async (req, res, next) => {
    try {
        const channel = await loadForMember(req, res);
        if (!channel) return;
        if (!mutedByUser(channel, req.user.sub)) {
            await Channel.updateOne({ _id: channel._id }, { $push: { mutedBy: { user: req.user.sub, mutedAt: new Date() } } });
        }
        res.json({ success: true, isMuted: true });
    } catch (err) { next(err); }
};

exports.unmute = async (req, res, next) => {
    try {
        const channel = await loadForMember(req, res);
        if (!channel) return;
        await Channel.updateOne({ _id: channel._id }, { $pull: { mutedBy: { user: req.user.sub } } });
        res.json({ success: true, isMuted: false });
    } catch (err) { next(err); }
};

// ── @channel / @here policy ──────────────────────────────────────────────────

const Workspace = require('../../../models/Workspace');

async function canManage(channel, userId) {
    if ((channel.admins || []).some((a) => String(a) === String(userId))) return true;
    return !!(await Workspace.exists({
        _id: channel.workspace,
        members: { $elemMatch: { user: userId, status: 'active', role: { $in: ['owner', 'admin'] } } },
    }));
}

exports.setMentionPolicy = async (req, res, next) => {
    try {
        const { broadcastMentions } = req.body || {};
        if (!['everyone', 'admins'].includes(broadcastMentions)) {
            return res.status(400).json({ message: 'broadcastMentions must be "everyone" or "admins"' });
        }
        const channel = await Channel.findById(req.params.id).select('members admins workspace company name');
        if (!channel || !isActualMember(channel, req.user.sub)) return res.status(404).json({ message: 'Channel not found' });
        if (!(await canManage(channel, req.user.sub))) {
            return res.status(403).json({ message: 'Only channel admins can change who may use @channel and @here' });
        }
        await Channel.updateOne({ _id: channel._id }, { $set: { broadcastMentions } });
        await recordAdminAction({
            userId: req.user.sub, companyId: channel.company, action: 'channel.mention_policy_changed',
            category: 'permissions', resourceType: 'Channel', resourceId: channel._id, resourceName: channel.name,
            details: { broadcastMentions }, req,
        });
        res.json({ success: true, broadcastMentions });
    } catch (err) { next(err); }
};

exports.canManageChannel = canManage;

exports.setPostingPolicy = async (req, res, next) => {
    try {
        const { postingPolicy } = req.body || {};
        if (!['everyone', 'admins'].includes(postingPolicy)) {
            return res.status(400).json({ message: 'postingPolicy must be "everyone" or "admins"' });
        }
        const channel = await Channel.findById(req.params.id).select('members admins workspace company name');
        if (!channel || !isActualMember(channel, req.user.sub)) return res.status(404).json({ message: 'Channel not found' });
        if (!(await canManage(channel, req.user.sub))) {
            return res.status(403).json({ message: 'Only channel admins can change who may post' });
        }
        await Channel.updateOne({ _id: channel._id }, { $set: { postingPolicy } });
        const io = req.app?.get('io');
        if (io) io.to(`channel:${channel._id}`).emit('channel:policy-updated', { channelId: String(channel._id), postingPolicy });
        await recordAdminAction({
            userId: req.user.sub, companyId: channel.company, action: 'channel.posting_policy_changed',
            category: 'permissions', resourceType: 'Channel', resourceId: channel._id, resourceName: channel.name,
            details: { postingPolicy }, req,
        });
        res.json({ success: true, postingPolicy });
    } catch (err) { next(err); }
};
