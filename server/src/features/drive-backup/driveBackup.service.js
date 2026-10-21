'use strict';

/**
 * Google Drive backup: connect a Google account, back up (manual, daily, and an hour after
 * significant changes), preview and apply a restore, change account, disconnect.
 *
 * Exactly one file per person, `oruinwan-backup.bin`, in the Drive's hidden appDataFolder.
 * Every backup overwrites that file in place (by file id); duplicates found by name are
 * removed. See docs/api/backup.md.
 */

const crypto = require('crypto');
const logger = require('../../../utils/logger');
const DriveBackup = require('./driveBackup.model');
const drive = require('./googleDrive.client');
const box = require('./driveBackup.crypto');
const sections = require('./driveBackup.sections');
const otpStore = require('../../shared/services/otpStore');
const { claim } = require('../../modules/notifications/notificationClaim.model');

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const LEASE_MS = 20 * MINUTE;
const STATE_TTL_MS = 10 * MINUTE;
const CLIENTS = new Set(['web', 'desktop', 'app']);

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });

function configured(env = process.env) {
    if (!drive.oauthConfig(env).configured) return false;
    try { require('../../services/kekManager.service').getActiveKEK(); return true; } catch { return false; }
}

function requireConfigured() {
    if (!configured()) throw fail(503, "Backup isn't configured on this server", 'BACKUP_NOT_CONFIGURED');
}

function view(rec) {
    return {
        configured: configured(),
        connected: Boolean(rec?.refreshTokenSealed),
        googleEmail: rec?.refreshTokenSealed ? rec.googleEmail : null,
        autoBackup: rec ? rec.autoBackup !== false : true,
        status: rec?.status || 'idle',
        lastError: rec?.lastError || null,
        lastBackupAt: rec?.lastBackupAt || null,
        lastBackupSize: rec?.lastBackupSize || 0,
        lastCounts: rec?.lastCounts || null,
        lastAttemptAt: rec?.lastAttemptAt || null,
        lastRestoreAt: rec?.lastRestoreAt || null,
        hold: rec?.refreshTokenSealed ? rec.hold || null : null,
        connectedAt: rec?.connectedAt || null,
        fileName: drive.FILE_NAME,
    };
}

async function getStatus(userId, { offer = false } = {}) {
    const rec = await DriveBackup.findOne({ userId: String(userId) }).lean();
    const out = view(rec);
    if (offer) out.accountLooksEmpty = await accountLooksEmpty(userId);
    return out;
}

/** True when the account has no notes, tasks or knowledge pages of its own (fresh or wiped). */
async function accountLooksEmpty(userId) {
    const uid = String(userId);
    const d = sections.deps();
    try {
        const [note, page] = await Promise.all([d.Note.exists({ owner: uid }), d.KnowledgePage.exists({ createdBy: uid })]);
        if (note || page) return false;
        if (d.tasksOnPg()) return (await d.tasksRepo().count({ createdBy: uid })) === 0;
        return !(await d.Task.exists({ createdBy: uid }));
    } catch {
        return false;
    }
}

// ── Connect / disconnect ─────────────────────────────────────────────────────

async function startConnect(userId, { client = 'web', loginHint } = {}) {
    requireConfigured();
    const state = crypto.randomBytes(32).toString('hex');
    await otpStore.set(`drive-backup:${state}`, { userId: String(userId), client: CLIENTS.has(client) ? client : 'web' }, STATE_TTL_MS);
    return { url: drive.authUrl({ state, loginHint }) };
}

/**
 * Google redirected back. Returns { client, result: 'connected' | <error code> } for the
 * route to turn into the right redirect (web page, desktop page, or app link).
 */
async function finishConnect({ state, code, error }) {
    const key = `drive-backup:${String(state || '')}`;
    const pending = /^[a-f0-9]{64}$/.test(String(state || '')) ? await otpStore.get(key) : null;
    if (pending) await otpStore.delete(key);
    if (!pending) return { client: 'web', result: 'expired' };
    const { userId, client } = pending;
    if (error || !code) return { client, result: error === 'access_denied' ? 'denied' : 'failed' };

    let tokens;
    try {
        tokens = await drive.exchangeCode(String(code));
    } catch (err) {
        logger.warn(`[BACKUP] code exchange failed: ${err.message}`);
        return { client, result: 'failed' };
    }
    if (!/(^|\s)https:\/\/www\.googleapis\.com\/auth\/drive\.appdata(\s|$)/.test(tokens.scope || '')) {
        // Google lets people untick individual permissions; without this one there is nothing to do.
        if (tokens.refreshToken) await drive.revoke(tokens.refreshToken);
        return { client, result: 'scope_denied' };
    }
    if (!tokens.refreshToken) return { client, result: 'failed' };

    const prev = await DriveBackup.findOne({ userId }).lean();
    if (prev?.refreshTokenSealed) {
        try { await drive.revoke(box.openSecret(prev.refreshTokenSealed)); } catch { /* old token unreadable or gone */ }
    }
    const sameAccount = prev && prev.googleEmail && tokens.email && prev.googleEmail.toLowerCase() === tokens.email.toLowerCase();
    // A backup already in this Google account (reinstall, or switching back): never overwrite it
    // before the person has had the chance to restore it.
    let found = null;
    if (!sameAccount) {
        try {
            const files = await drive.findBackupFiles(tokens.accessToken);
            found = [...files].sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)))[0] || null;
        } catch (err) {
            logger.warn(`[BACKUP] could not look for an existing backup: ${err.message}`);
        }
    }
    await DriveBackup.updateOne({ userId }, {
        $set: {
            refreshTokenSealed: box.sealSecret(tokens.refreshToken),
            googleEmail: tokens.email,
            connectedAt: new Date(),
            status: 'idle',
            lastError: null,
            runningUntil: null,
            ...(sameAccount ? {} : found
                ? { fileId: found.id, lastBackupAt: found.modifiedTime ? new Date(found.modifiedTime) : null, lastBackupSize: Number(found.size) || 0, lastCounts: null, hold: 'existing-backup' }
                : { fileId: null, lastBackupAt: null, lastBackupSize: 0, lastCounts: null, hold: null }),
        },
        $setOnInsert: { autoBackup: true },
    }, { upsert: true });

    // First backup right away (new account), so there's something to restore.
    if (!sameAccount && !found) setImmediate(() => backupNow(userId).catch((err) => logger.warn(`[BACKUP] first backup failed: ${err.message}`)));
    return { client, result: found ? 'found' : 'connected' };
}

async function disconnect(userId, { deleteBackup = false } = {}) {
    const uid = String(userId);
    const rec = await DriveBackup.findOne({ userId: uid }).lean();
    if (!rec?.refreshTokenSealed) return { ...view(rec), deleted: false };
    let deleted = false;
    let refresh = null;
    try { refresh = box.openSecret(rec.refreshTokenSealed); } catch { /* sealed with a retired KEK */ }
    if (refresh) {
        if (deleteBackup) {
            try {
                const token = await drive.accessToken(refresh);
                const ids = new Set([rec.fileId, ...(await drive.findBackupFiles(token)).map((f) => f.id)].filter(Boolean));
                for (const id of ids) deleted = (await drive.deleteFile(token, id)) || deleted;
            } catch (err) {
                throw fail(502, `Couldn't delete the backup from Google Drive: ${err.message}. Nothing was disconnected.`, 'DRIVE_ERROR');
            }
        }
        await drive.revoke(refresh);
    }
    await DriveBackup.updateOne({ userId: uid }, {
        $set: { refreshTokenSealed: null, googleEmail: null, fileId: null, status: 'idle', lastError: null, runningUntil: null, dirtyAt: null, lastBackupAt: null, lastBackupSize: 0, lastCounts: null },
    });
    return { ...(await getStatus(uid)), deleted };
}

async function setAutoBackup(userId, on) {
    await DriveBackup.updateOne({ userId: String(userId) }, { $set: { autoBackup: Boolean(on) } }, { upsert: true });
    return getStatus(userId);
}

// ── Backup ───────────────────────────────────────────────────────────────────

/** Take the per-user lease; null when another run holds it or the account isn't connected. */
async function lease(userId, now = new Date(), status = 'running') {
    return DriveBackup.findOneAndUpdate(
        { userId: String(userId), refreshTokenSealed: { $ne: null }, $or: [{ runningUntil: null }, { runningUntil: { $lt: now } }] },
        { $set: { runningUntil: new Date(now.getTime() + LEASE_MS), ...(status ? { status, lastAttemptAt: now } : {}) } },
        { new: true }
    ).lean();
}

async function release(userId, set) {
    await DriveBackup.updateOne({ userId: String(userId) }, { $set: { runningUntil: null, ...set } });
}

async function tokenFor(rec) {
    let refresh;
    try { refresh = box.openSecret(rec.refreshTokenSealed); } catch { throw fail(409, 'Connect Google Drive again', 'DRIVE_REAUTH'); }
    return drive.accessToken(refresh);
}

/** The id of our single file: the stored id if it still exists, else the first found by name (extras deleted). */
async function resolveFileId(token, rec, { cleanup = true } = {}) {
    if (rec.fileId && await drive.getFileMeta(token, rec.fileId)) {
        if (cleanup) {
            const extras = (await drive.findBackupFiles(token)).filter((f) => f.id !== rec.fileId);
            for (const f of extras) await drive.deleteFile(token, f.id).catch(() => {});
        }
        return rec.fileId;
    }
    const files = await drive.findBackupFiles(token);
    if (!files.length) return null;
    const sorted = [...files].sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
    if (cleanup) for (const f of sorted.slice(1)) await drive.deleteFile(token, f.id).catch(() => {});
    return sorted[0].id;
}

function errorSet(err) {
    if (err.code === 'DRIVE_REAUTH') return { status: 'reauth', lastError: 'Google access was removed. Connect Google Drive again.' };
    return { status: 'error', lastError: String(err.message || 'Backup failed').slice(0, 300) };
}

async function runBackup(rec, startedAt = new Date()) {
    const uid = rec.userId;
    try {
        const token = await tokenFor(rec);
        const { bundle, counts } = await sections.collect(uid);
        const bytes = box.packBackup(bundle, { userId: uid, meta: { counts } });
        const fileId = await resolveFileId(token, rec);
        const up = await drive.upload(token, bytes, { fileId });
        await release(uid, { fileId: up.id, lastBackupAt: new Date(), lastBackupSize: up.size || bytes.length, lastCounts: counts, status: 'ok', lastError: null, hold: null });
        await DriveBackup.updateOne({ userId: uid, dirtyAt: { $lte: startedAt } }, { $set: { dirtyAt: null } });
        return { ok: true, size: bytes.length, counts };
    } catch (err) {
        logger.warn(`[BACKUP] backup for ${uid} failed: ${err.message}`);
        await release(uid, errorSet(err));
        throw err;
    }
}

async function backupNow(userId) {
    requireConfigured();
    const rec = await lease(userId);
    if (!rec) {
        const existing = await DriveBackup.findOne({ userId: String(userId) }).lean();
        if (!existing?.refreshTokenSealed) throw fail(409, 'Connect Google Drive first', 'BACKUP_NOT_CONNECTED');
        throw fail(409, 'A backup is already running', 'BACKUP_RUNNING');
    }
    try {
        await runBackup(rec);
    } catch (err) {
        throw fail(err.code === 'DRIVE_REAUTH' ? 409 : 502, err.message, err.code || 'DRIVE_ERROR');
    }
    return getStatus(userId);
}

/**
 * Job: back up everyone due. Due = automatic on, connected, not needing re-auth, and either
 * no backup in the last day or a significant change since the last backup and none in the
 * last hour. The claim key (one per user per hour) makes it at-most-once fleet-wide even if
 * several instances run the job; the lease keeps it from overlapping a manual run.
 */
async function runDueBackups({ now = new Date(), limit = 200 } = {}) {
    if (!configured()) return { ran: 0 };
    const dayAgo = new Date(now.getTime() - DAY);
    const hourAgo = new Date(now.getTime() - HOUR);
    const due = await DriveBackup.find({
        autoBackup: { $ne: false },
        refreshTokenSealed: { $ne: null },
        status: { $ne: 'reauth' },
        hold: null,
        $or: [
            { lastBackupAt: null },
            { lastBackupAt: { $lt: dayAgo } },
            { dirtyAt: { $ne: null }, lastBackupAt: { $lt: hourAgo } },
        ],
    }).select('userId').limit(limit).lean();

    const hourKey = now.toISOString().slice(0, 13);
    let ran = 0;
    for (const { userId } of due) {
        if (!(await claim(`drive-backup:${userId}:${hourKey}`))) continue;
        const rec = await lease(userId, now);
        if (!rec) continue;
        // Don't replace a backup that has content with one of an account that looks wiped.
        const c = rec.lastCounts || {};
        if ((c.notes || 0) + (c.tasks || 0) + (c.knowledge || 0) > 0 && await accountLooksEmpty(userId)) {
            await release(userId, { hold: 'account-empty', status: rec.status === 'running' ? 'ok' : rec.status });
            continue;
        }
        try { await runBackup(rec, now); ran += 1; } catch { /* recorded on the row */ }
    }
    return { ran, due: due.length };
}

// Significant changes: at most one write per user per 5 minutes reaches the database.
const lastMarked = new Map();
async function markDirty(userId, now = Date.now()) {
    const uid = String(userId || '');
    if (!uid) return;
    const prev = lastMarked.get(uid);
    if (prev && now - prev < 5 * MINUTE) return;
    lastMarked.set(uid, now);
    if (lastMarked.size > 50_000) lastMarked.clear();
    await DriveBackup.updateOne({ userId: uid, refreshTokenSealed: { $ne: null }, dirtyAt: null }, { $set: { dirtyAt: new Date(now) } });
}

/** Express middleware: a successful write by a signed-in user marks their backup dirty. */
function markDirtyOnWrite(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    res.on('finish', () => {
        const uid = req.user?.sub || req.user?.id;
        if (uid && res.statusCode >= 200 && res.statusCode < 300) markDirty(uid).catch(() => {});
    });
    return next();
}

// ── Restore ──────────────────────────────────────────────────────────────────

async function loadBackup(userId) {
    requireConfigured();
    const rec = await DriveBackup.findOne({ userId: String(userId) }).lean();
    if (!rec?.refreshTokenSealed) throw fail(409, 'Connect Google Drive first', 'BACKUP_NOT_CONNECTED');
    const token = await tokenFor(rec).catch((err) => { throw fail(err.code === 'DRIVE_REAUTH' ? 409 : 502, err.message, err.code); });
    const fileId = await resolveFileId(token, rec, { cleanup: false });
    if (!fileId) throw fail(404, 'There is no backup in this Google account yet', 'BACKUP_NOT_FOUND');
    const bytes = await drive.download(token, fileId);
    try {
        return { ...box.unpackBackup(bytes, { userId }), size: bytes.length };
    } catch (err) {
        throw fail(err.code === 'BACKUP_OWNER' ? 403 : 422, err.message, err.code);
    }
}

function about(header, size) {
    return { createdAt: header.createdAt, size, counts: header.counts || null };
}

async function previewRestore(userId) {
    const { header, bundle, size } = await loadBackup(userId);
    const plan = await sections.restore(userId, bundle, { dryRun: true });
    return { backup: about(header, size), ...plan };
}

async function applyRestore(userId) {
    const now = new Date();
    const rec = await lease(userId, now, null);
    if (!rec) throw fail(409, 'A backup is running. Try again in a minute.', 'BACKUP_RUNNING');
    try {
        const { header, bundle, size } = await loadBackup(userId);
        const result = await sections.restore(userId, bundle, { dryRun: false });
        await release(userId, { lastRestoreAt: new Date(), hold: null, dirtyAt: new Date() });
        return { backup: about(header, size), ...result };
    } catch (err) {
        await release(userId, {});
        throw err;
    }
}

module.exports = {
    configured, getStatus, startConnect, finishConnect, disconnect, setAutoBackup,
    backupNow, runDueBackups, markDirty, markDirtyOnWrite, previewRestore, applyRestore,
    resolveFileId, lease, accountLooksEmpty,
};
