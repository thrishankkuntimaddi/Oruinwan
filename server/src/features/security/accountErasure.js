'use strict';

/**
 * Self-service account erasure, shared by
 *   DELETE /api/compliance/delete-user
 *   DELETE /api/users/me
 *
 * What it does:
 *   - refuses company-managed accounts (403) and accounts under legal hold (403)
 *   - deletes data only the user owns in MongoDB / object storage: their AI memories,
 *     their private notes (and those notes' AI embeddings), their notification
 *     preferences, their profile picture; removes them from channel member lists
 *   - then deletes every identity row in PostgreSQL in one transaction (the users row
 *     cascades to emails, tokens, one-time codes, devices, workspace / department / team
 *     memberships, E2EE keys and sessions). Documents that still reference the id
 *     resolve to no user, which the clients render as a deleted user.
 *
 * It never deletes other people's data: tasks (created by or assigned to them), DM
 * sessions and messages stay; shared or public notes stay.
 */

const logger = require('../../../utils/logger');
const identity = require('../../identity');
const securityQueries = require('../../identity/queries/security');
const AuditLog = require('../../../models/AuditLog');

const DELETED_USERNAME = '[Deleted User]';
const COMPANY_MANAGED_MESSAGE = 'Your account is managed by your company. Ask an administrator to remove it.';

class ErasureError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

function isCompanyManaged(user) {
    return user.userType === 'company' || !!user.companyId;
}

function deletedEmailFor(userId) {
    return `deleted_${userId}@deleted.oruinwan.invalid`;
}

async function deleteProfilePictureObject(gcsPath) {
    if (!gcsPath) return;
    try {
        const { deleteObject } = require('../../modules/uploads/upload.service');
        await deleteObject(gcsPath);
    } catch (err) {
        logger.warn({ err: err.message }, '[Erasure] Could not delete profile picture object');
    }
}

/** Run one cleanup step; a failure is logged and reported, never aborts the erasure. */
async function step(results, name, fn) {
    try {
        const r = await fn();
        results[name] = r && typeof r === 'object'
            ? (r.deletedCount ?? r.modifiedCount ?? 0)
            : (r ?? 0);
    } catch (err) {
        logger.warn({ err: err.message, step: name }, '[Erasure] cleanup step failed');
        results[name] = 'failed';
    }
}

/**
 * Erase the account `userId`. Throws ErasureError(404 | 403) when it may not be erased.
 * Returns { erased: true, cleanup: { <step>: count | 'failed' } }.
 */
async function eraseAccount(userId, { req } = {}) {
    const found = await identity.users.findById(userId);
    const user = found ? { ...found, ...securityQueries.legalHoldOf(found) } : null;
    if (!user) throw new ErasureError(404, 'User not found');

    if (isCompanyManaged(user)) {
        throw new ErasureError(403, COMPANY_MANAGED_MESSAGE, { code: 'COMPANY_MANAGED' });
    }
    if (user.legalHold) {
        throw new ErasureError(403, 'Account is under legal hold and cannot be deleted.', {
            code: 'LEGAL_HOLD',
            reason: user.legalHoldReason || 'Legal hold active',
        });
    }

    const uid = user._id;

    // Written first so the request is on record even if a later step fails. No PII in it.
    await AuditLog.create({
        userId: uid,
        action: 'compliance.delete_user',
        resource: 'User',
        resourceId: uid,
        description: 'Account erasure requested by the user',
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent'],
        category: 'security',
        severity: 'critical',
    });

    const results = {};
    const Channel = require('../channels/channel.model');
    const Note = require('../../../models/Note');
    const AIMemory = require('../../models/AIMemory');
    const knowledge = require('../ai/ai.knowledge.service');

    await step(results, 'channelsLeft', () => Channel.updateMany(
        { $or: [{ 'members.user': uid }, { admins: uid }] },
        { $pull: { members: { user: uid }, admins: uid } }
    ));

    await step(results, 'aiMemoriesDeleted', () => AIMemory.deleteMany({ user: uid }));

    // Private notes only; notes shared with others or published to the workspace stay.
    await step(results, 'privateNotesDeleted', async () => {
        const notes = await Note.find({
            owner: uid,
            isPublic: { $ne: true },
            $or: [{ sharedWith: { $exists: false } }, { sharedWith: { $size: 0 } }],
        }).select('_id').lean();
        const ids = notes.map(n => n._id);
        if (!ids.length) return 0;
        await knowledge.forgetSources('note', ids);
        const r = await Note.deleteMany({ _id: { $in: ids }, owner: uid });
        return r.deletedCount || 0;
    });

    await step(results, 'notificationPreferencesDeleted', () => {
        const NotificationPreference = require('../../modules/notifications/notificationPreference.model');
        return NotificationPreference.deleteMany({ userId: uid });
    });

    await deleteProfilePictureObject(user.profilePictureGcsPath);

    // Identity rows last, all or nothing: memberships, keys, sessions and the user go together.
    const identityCounts = await securityQueries.eraseIdentity(uid, { personalWorkspaceId: user.personalWorkspace });
    Object.assign(results, identityCounts);

    // Drop any live sockets for this user.
    try {
        const { getIO } = require('../../socket/getIO');
        const io = getIO();
        if (io) io.in(`user:${uid}`).disconnectSockets(true);
    } catch (err) {
        logger.warn({ err: err.message }, '[Erasure] Could not disconnect sockets');
    }

    // Forget cached privacy preferences.
    try { require('../auth/privacy.service').forgetPrivacy(uid); } catch { /* optional */ }

    logger.info({ userId: String(uid), cleanup: results }, '[Erasure] Account erased');
    return { erased: true, cleanup: results };
}

module.exports = {
    eraseAccount,
    ErasureError,
    isCompanyManaged,
    deletedEmailFor,
    DELETED_USERNAME,
    COMPANY_MANAGED_MESSAGE,
};
