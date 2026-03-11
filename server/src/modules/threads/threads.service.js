// server/src/modules/threads/threads.service.js
//
// Thread follow/unfollow business logic.
// Keeps the controller thin and the follow semantics in one place.

const Message = require('../../features/messages/message.model.js');

/**
 * Add userId to the thread's followers array (idempotent via $addToSet).
 * Works on the parent message document.
 *
 * @param {string} messageId  Parent message _id
 * @param {string} userId     User to follow
 * @returns {Promise<{ following: true, followerCount: number }>}
 */
async function followThread(messageId, userId) {
    const updated = await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { followers: userId } },
        { new: true, select: 'followers' }
    ).lean();

    if (!updated) throw Object.assign(new Error('Thread not found'), { status: 404 });

    return { following: true, followerCount: updated.followers.length };
}

/**
 * Remove userId from the thread's followers array.
 *
 * @param {string} messageId
 * @param {string} userId
 * @returns {Promise<{ following: false, followerCount: number }>}
 */
async function unfollowThread(messageId, userId) {
    const updated = await Message.findByIdAndUpdate(
        messageId,
        { $pull: { followers: userId } },
        { new: true, select: 'followers' }
    ).lean();

    if (!updated) throw Object.assign(new Error('Thread not found'), { status: 404 });

    return { following: false, followerCount: updated.followers.length };
}

/**
 * Check whether userId is following messageId and get current follower count.
 *
 * @param {string} messageId
 * @param {string} userId
 * @returns {Promise<{ following: boolean, followerCount: number }>}
 */
async function getFollowStatus(messageId, userId) {
    const msg = await Message.findById(messageId).select('followers').lean();
    if (!msg) throw Object.assign(new Error('Thread not found'), { status: 404 });

    const followerStrings = (msg.followers || []).map(String);
    return {
        following: followerStrings.includes(String(userId)),
        followerCount: followerStrings.length,
    };
}

/**
 * Get the full list of follower user IDs for a thread.
 * Used internally by postThreadReply for notification fan-out.
 *
 * @param {string} messageId
 * @returns {Promise<string[]>}
 */
async function getFollowerIds(messageId) {
    const msg = await Message.findById(messageId).select('followers').lean();
    return (msg?.followers || []).map(String);
}

module.exports = { followThread, unfollowThread, getFollowStatus, getFollowerIds };
