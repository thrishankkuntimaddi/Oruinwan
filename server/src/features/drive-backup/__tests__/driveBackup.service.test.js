'use strict';

/**
 * Google Drive backup service with Google mocked: connecting seals the token, every backup
 * overwrites the one file in appDataFolder, the job claims each user once per hour across
 * instances, disconnect revokes (and optionally deletes), restore needs the owner.
 */

process.env.CRYPTO_KEK_V1 = 'c'.repeat(64);
process.env.CRYPTO_KEK_ACTIVE_VERSION = '1';
process.env.GOOGLE_CLIENT_ID = 'client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
process.env.BACKEND_URL = 'https://api.example.test';

const { fakeGoogle } = require('./fakes');

jest.mock('../driveBackup.model', () => require('./fakes').fakeModel());
jest.mock('../../../modules/notifications/notificationClaim.model', () => {
    const keys = new Set();
    return { keys, claim: jest.fn(async (k) => (keys.has(k) ? false : (keys.add(k), true))) };
});
jest.mock('../../../shared/services/otpStore', () => {
    const m = new Map();
    return { set: async (k, v) => m.set(k, v), get: async (k) => m.get(k) ?? null, delete: async (k) => m.delete(k) };
});
jest.mock('../driveBackup.sections', () => {
    const { fakeModel: fm } = require('./fakes');
    const Note = fm();
    return {
        Note,
        collect: jest.fn(async (userId) => ({ bundle: { profile: { username: 'ada' }, notes: [{ _id: 'n1', owner: userId, title: 'Hello' }] }, counts: { notes: 1, tasks: 0, knowledge: 0 } })),
        restore: jest.fn(async (userId, bundle, { dryRun }) => ({ dryRun, total: bundle.notes.length, sections: { notes: { inBackup: 1, present: 0, restore: 1, skipped: 0 } } })),
        deps: () => ({ Note, KnowledgePage: fm(), Task: fm(), tasksOnPg: () => false }),
    };
});

const DriveBackup = require('../driveBackup.model');
const drive = require('../googleDrive.client');
const box = require('../driveBackup.crypto');
const service = require('../driveBackup.service');
const sections = require('../driveBackup.sections');
const claims = require('../../../modules/notifications/notificationClaim.model');

const ADA = '64b0000000000000000000a1';
let google;

beforeEach(() => {
    DriveBackup.docs.length = 0;
    sections.Note.docs.length = 0;
    sections.Note.docs.push({ _id: 'n1', owner: ADA }); // the account has content of its own
    claims.keys.clear();
    google = fakeGoogle();
    drive._setHttpForTests(google);
});

afterAll(() => drive._setHttpForTests(null));

async function connect(code = 'code-ada', userId = ADA, client = 'web') {
    const { url } = await service.startConnect(userId, { client });
    const u = new URL(url);
    expect(u.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/drive.appdata');
    expect(u.searchParams.get('scope')).not.toMatch(/auth\/drive(\s|$)/); // never full Drive access
    expect(u.searchParams.get('redirect_uri')).toBe('https://api.example.test/api/v2/backup/google/callback');
    expect(u.searchParams.get('access_type')).toBe('offline');
    const out = await service.finishConnect({ state: u.searchParams.get('state'), code });
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setTimeout(r, 0));
    return out;
}

const backupFiles = () => [...google.files.values()].filter((f) => f.name === 'oruinwan-backup.bin');

test('without a client secret the server says backup is not configured', async () => {
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_SECRET;
    try {
        expect((await service.getStatus(ADA)).configured).toBe(false);
        await expect(service.startConnect(ADA)).rejects.toMatchObject({ status: 503, code: 'BACKUP_NOT_CONFIGURED' });
    } finally {
        process.env.GOOGLE_CLIENT_SECRET = secret;
    }
});

test('connecting stores only a sealed refresh token and makes the first backup', async () => {
    expect(await connect()).toEqual({ client: 'web', result: 'connected' });
    const rec = DriveBackup.docs[0];
    expect(rec.googleEmail).toBe('ada@gmail.com');
    expect(rec.refreshTokenSealed).not.toContain('rt-code-ada');
    expect(box.openSecret(rec.refreshTokenSealed)).toBe('rt-code-ada');
    expect(JSON.stringify(rec)).not.toContain('rt-code-ada');

    const status = await service.getStatus(ADA);
    expect(status).toMatchObject({ configured: true, connected: true, googleEmail: 'ada@gmail.com', status: 'ok', lastCounts: { notes: 1 } });
    expect(backupFiles()).toHaveLength(1);
    // The file in Drive is ciphertext.
    expect(backupFiles()[0].bytes.toString('latin1')).not.toContain('Hello');
});

test('an unknown or reused state is refused', async () => {
    expect(await service.finishConnect({ state: 'f'.repeat(64), code: 'x' })).toEqual({ client: 'web', result: 'expired' });
    const { url } = await service.startConnect(ADA, { client: 'app' });
    const state = new URL(url).searchParams.get('state');
    expect((await service.finishConnect({ state, code: 'code-ada' })).result).toBe('connected');
    expect((await service.finishConnect({ state, code: 'code-ada' })).result).toBe('expired');
});

test('every backup overwrites the same single file (update by id, never a second create)', async () => {
    await connect();
    const [first] = backupFiles();
    google.calls.length = 0;

    await service.backupNow(ADA);
    await service.backupNow(ADA);

    expect(backupFiles()).toHaveLength(1);
    expect(backupFiles()[0].id).toBe(first.id);
    const creates = google.calls.filter(([m, url]) => m === 'POST' && url.includes('/upload/'));
    const patches = google.calls.filter(([m, url]) => m === 'PATCH' && url.endsWith(`/files/${first.id}`));
    expect(creates).toHaveLength(0);
    expect(patches).toHaveLength(2);
});

test('stray duplicates are removed so only one backup file remains', async () => {
    await connect();
    const keep = DriveBackup.docs[0].fileId;
    google.addFile();
    google.addFile();
    expect(backupFiles()).toHaveLength(3);
    await service.backupNow(ADA);
    expect(backupFiles().map((f) => f.id)).toEqual([keep]);
});

test('if the file was deleted in Drive, the next backup creates it again (still one file)', async () => {
    await connect();
    google.files.clear();
    await service.backupNow(ADA);
    expect(backupFiles()).toHaveLength(1);
    expect(DriveBackup.docs[0].fileId).toBe(backupFiles()[0].id);
});

test('a Google account that already holds a backup is not overwritten until the person decides', async () => {
    const existing = google.addFile('oruinwan-backup.bin', Buffer.from('earlier backup'), '2026-03-01T10:00:00.000Z');
    expect((await connect()).result).toBe('found');
    expect(google.files.get(existing).bytes.toString()).toBe('earlier backup');
    expect(DriveBackup.docs[0]).toMatchObject({ fileId: existing, hold: 'existing-backup' });

    // The job leaves it alone...
    expect((await service.runDueBackups({ now: new Date('2026-10-21T12:00:00Z') })).ran).toBe(0);
    expect(google.files.get(existing).bytes.toString()).toBe('earlier backup');
    // ...until "Back up now" replaces it, in place.
    await service.backupNow(ADA);
    expect(backupFiles().map((f) => f.id)).toEqual([existing]);
    expect(DriveBackup.docs[0].hold).toBeNull();
});

test('the job backs each person up at most once per hour, even with several instances', async () => {
    await connect();
    DriveBackup.docs[0].lastBackupAt = new Date('2026-10-19T00:00:00Z'); // over a day ago
    google.calls.length = 0;
    const now = new Date('2026-10-21T12:05:00Z');

    const [a, b] = await Promise.all([service.runDueBackups({ now }), service.runDueBackups({ now })]);
    expect(a.ran + b.ran).toBe(1);
    expect(claims.claim).toHaveBeenCalledWith(`drive-backup:${ADA}:2026-10-21T12`);

    // Same hour again: claimed already, nothing runs.
    DriveBackup.docs[0].lastBackupAt = new Date('2026-10-19T00:00:00Z');
    expect((await service.runDueBackups({ now })).ran).toBe(0);
});

test('a significant change makes a backup due an hour after the last one; a running lease blocks overlap', async () => {
    await connect();
    const now = new Date('2026-10-21T15:00:00Z');
    DriveBackup.docs[0].lastBackupAt = new Date('2026-10-21T14:30:00Z');
    await service.markDirty(ADA, now.getTime());
    expect(DriveBackup.docs[0].dirtyAt).toBeTruthy();
    expect((await service.runDueBackups({ now })).ran).toBe(0); // backed up 30 min ago

    DriveBackup.docs[0].lastBackupAt = new Date('2026-10-21T13:30:00Z');
    DriveBackup.docs[0].runningUntil = new Date(now.getTime() + 60_000); // a manual run holds the lease
    expect((await service.runDueBackups({ now })).ran).toBe(0);

    DriveBackup.docs[0].runningUntil = null;
    const later = new Date('2026-10-21T16:00:00Z');
    expect((await service.runDueBackups({ now: later })).ran).toBe(1);
    expect(DriveBackup.docs[0].dirtyAt).toBeNull();
});

test('automatic backup off: the job skips the person', async () => {
    await connect();
    await service.setAutoBackup(ADA, false);
    DriveBackup.docs[0].lastBackupAt = new Date('2026-01-01T00:00:00Z');
    expect((await service.runDueBackups({ now: new Date('2026-10-21T12:00:00Z') })).ran).toBe(0);
});

test('an account that looks wiped does not overwrite a backup with content', async () => {
    await connect();
    DriveBackup.docs[0].lastBackupAt = new Date('2026-01-01T00:00:00Z');
    sections.Note.docs.length = 0; // no notes, tasks or pages of their own any more
    expect((await service.runDueBackups({ now: new Date('2026-10-21T12:00:00Z') })).ran).toBe(0);
    expect(DriveBackup.docs[0].hold).toBe('account-empty');
});

test('revoked Google access shows "connect again" instead of failing silently', async () => {
    await connect();
    DriveBackup.docs[0].refreshTokenSealed = box.sealSecret('rt-revoked');
    await expect(service.backupNow(ADA)).rejects.toMatchObject({ code: 'DRIVE_REAUTH' });
    expect((await service.getStatus(ADA)).status).toBe('reauth');
});

test('restore: preview first, then apply; both read the single Drive file', async () => {
    await connect();
    const preview = await service.previewRestore(ADA);
    expect(preview).toMatchObject({ dryRun: true, total: 1, backup: { counts: { notes: 1 } } });
    const done = await service.applyRestore(ADA);
    expect(done).toMatchObject({ dryRun: false, total: 1 });
    expect(DriveBackup.docs[0].lastRestoreAt).toBeTruthy();
});

test('change account: the old token is revoked and the new account gets its own backup', async () => {
    await connect('code-ada');
    google.files.clear(); // bob's Drive is a different Drive, with no backup yet
    expect((await connect('code-bob')).result).toBe('connected');
    expect(backupFiles()).toHaveLength(1);
    expect(google.revoked).toContain('rt-code-ada');
    expect(DriveBackup.docs[0].googleEmail).toBe('bob@gmail.com');
    expect(box.openSecret(DriveBackup.docs[0].refreshTokenSealed)).toBe('rt-code-bob');
});

test('disconnect revokes the token and can delete the backup from Drive', async () => {
    await connect();
    expect(backupFiles()).toHaveLength(1);
    const out = await service.disconnect(ADA, { deleteBackup: true });
    expect(out).toMatchObject({ connected: false, deleted: true });
    expect(backupFiles()).toHaveLength(0);
    expect(google.revoked).toContain('rt-code-ada');
    expect(DriveBackup.docs[0].refreshTokenSealed).toBeNull();
});

test('disconnect without deleting keeps the file in Drive', async () => {
    await connect();
    await service.disconnect(ADA, { deleteBackup: false });
    expect(backupFiles()).toHaveLength(1);
});
