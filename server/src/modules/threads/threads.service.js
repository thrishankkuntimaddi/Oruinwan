const Message = require('../../features/messages/message.model.js');

async function followThread(messageId, userId) {
    const updated = await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { followers: userId } },
        { new: true, select: 'followers' }
    ).lean();

    if (!updated) throw Object.assign(new Error('Thread not found'), { status: 404 });

    return { following: true, followerCount: updated.followers.length };
}

async function unfollowThread(messageId, userId) {
    const updated = await Message.findByIdAndUpdate(
        messageId,
        { $pull: { followers: userId } },
        { new: true, select: 'followers' }
    ).lean();

    if (!updated) throw Object.assign(new Error('Thread not found'), { status: 404 });

    return { following: false, followerCount: updated.followers.length };
}

async function getFollowStatus(messageId, userId) {
    const msg = await Message.findById(messageId).select('followers').lean();
    if (!msg) throw Object.assign(new Error('Thread not found'), { status: 404 });

    const followerStrings = (msg.followers || []).map(String);
    return {
        following: followerStrings.includes(String(userId)),
        followerCount: followerStrings.length,
    };
}

async function getFollowerIds(messageId) {
    const msg = await Message.findById(messageId).select('followers').lean();
    return (msg?.followers || []).map(String);
}

module.exports = { followThread, unfollowThread, getFollowStatus, getFollowerIds };
