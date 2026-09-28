'use strict';

/**
 * Self-service account erasure, shared by
 *   DELETE /api/compliance/delete-user
 *   DELETE /api/users/me
 *
 * What it does:
 *   - refuses company-managed accounts (403) and accounts under legal hold (403)
 *   - anonymises the User record in place (so messages, tasks and audit trails that
 *     reference it now show "[Deleted User]") and wipes credentials, sessions, 2FA,
 *     SSO/OAuth ids, emails, phone, profile, profile picture, preferences, block/mute lists
 *   - deletes data only the user owns: their AI memories, their private notes (and those
 *     notes' AI embeddings), their notification preferences and device sessions
 *   - removes them from channel and workspace member lists
 *
 * It never deletes other people's data: tasks (created by or assigned to them), DM
 * sessions and messages stay; shared or public notes stay.
 */

const logger = require('../../../utils/logger');
const User = require('../../../models/User');
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
        const { Storage } = require('@google-cloud/storage');
        const bucketName = process.env.GCS_BUCKET_NAME || 'chttrix-uploads';
        const storageClient = new Storage({ projectId: process.env.GCP_PROJECT_ID || 'chttrix-prod' });
        await storageClient.bucket(bucketName).file(gcsPath).delete();
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
    const user = await User.findById(userId)
        .select('legalHold legalHoldReason userType companyId profilePictureGcsPath personalWorkspace')
        .lean();
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
    const Workspace = require('../../../models/Workspace');
    const Note = require('../../../models/Note');
    const AIMemory = require('../../models/AIMemory');
    const AIEmbedding = require('../../models/AIEmbedding');

    await step(results, 'channelsLeft', () => Channel.updateMany(
        { $or: [{ 'members.user': uid }, { admins: uid }] },
        { $pull: { members: { user: uid }, admins: uid } }
    ));

    await step(results, 'workspacesLeft', () => Workspace.updateMany(
        { 'members.user': uid },
        { $pull: { members: { user: uid } } }
    ));

    // A personal workspace nobody else is in is closed (not deleted).
    if (user.personalWorkspace) {
        await step(results, 'personalWorkspaceClosed', () => Workspace.updateOne(
            { _id: user.personalWorkspace, 'members.0': { $exists: false } },
            { $set: { isActive: false } }
        ));
    }

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
        await AIEmbedding.deleteMany({ kind: 'note', ref: { $in: ids } });
        const r = await Note.deleteMany({ _id: { $in: ids }, owner: uid });
        return r.deletedCount || 0;
    });

    await step(results, 'notificationPreferencesDeleted', () => {
        const NotificationPreference = require('../../modules/notifications/notificationPreference.model');
        return NotificationPreference.deleteMany({ userId: uid });
    });

    await step(results, 'deviceSessionsDeleted', () => {
        const UserDeviceSession = require('../../models/UserDeviceSession');
        return UserDeviceSession.deleteMany({ userId: String(uid) });
    });

    await step(results, 'userSessionsDeleted', () => {
        const UserSession = require('../../../models/UserSession');
        return UserSession.deleteMany({ userId: uid });
    });

    await step(results, 'removedFromBlockLists', () => User.updateMany(
        { 'blockedUsers.userId': uid },
        { $pull: { blockedUsers: { userId: uid } } }
    ));

    await deleteProfilePictureObject(user.profilePictureGcsPath);

    // Anonymise in place. updateOne bypasses the pre-save hook (which would copy username into profile).
    const now = new Date();
    await User.updateOne({ _id: uid }, {
        $set: {
            email: deletedEmailFor(uid),
            username: DELETED_USERNAME,
            passwordHash: null,
            emails: [],
            profile: { name: DELETED_USERNAME },
            preferences: {},
            refreshTokens: [],
            devices: [],
            deviceTokens: [],
            otpCodes: [],
            twoFactorSecret: null,
            twoFactorEnabled: false,
            ssoId: null,
            ssoProvider: null,
            googleAccount: false,
            blockedUsers: [],
            mutedChats: [],
            favorites: [],
            workspaces: [],
            workHistory: [],
            personalWorkspace: null,
            retentionDays: null,
            accountStatus: 'removed',
            isActive: false,
            isOnline: false,
            verified: false,
            deactivatedAt: now,
        },
        $unset: {
            phone: 1,
            personalEmail: 1,
            companyEmail: 1,
            googleId: 1,
            githubId: 1,
            linkedinId: 1,
            profilePicture: 1,
            profilePictureGcsPath: 1,
            jobTitle: 1,
            encryption: 1,
            inviteToken: 1,
            verificationTokenHash: 1,
            verificationTokenExpires: 1,
            resetPasswordTokenHash: 1,
            resetPasswordExpires: 1,
        },
    });

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
