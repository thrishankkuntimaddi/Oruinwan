'use strict';

/**
 * Encrypted backups (AES-256-GCM with the server KEK) and a verified restore.
 *
 * A backup holds:
 *   - identity tables of the company (companies, users without secrets, workspaces,
 *     members, departments, teams) and its audit logs
 *   - workspace metadata (format v2): channels, tasks, notes, knowledge pages and
 *     categories, and file metadata (not the file bytes)
 * Chat messages are never included: they are end-to-end encrypted and the server
 * cannot and must not decrypt them.
 *
 * Restore only re-inserts workspace metadata documents that no longer exist (it
 * never overwrites live data and never touches identity tables or messages). It
 * always verifies first: the GCM tag, the format, a SHA-256 checksum per
 * collection, and that every document belongs to a workspace in the backup that
 * still exists (and, for company admins, still belongs to their company).
 * dryRun reports what would happen without writing.
 */

const crypto = require('crypto');
const { companyBackup } = require('../../identity/queries/security');
const AuditLog = require('../../../models/AuditLog');

const FORMAT = 'oruinwan-backup-v2';
const LEGACY_FORMAT = 'oruinwan-backup-v1';

class BackupError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function backupKey() {
  const key = Buffer.from(process.env.SERVER_KEK || '', 'hex');
  if (key.length !== 32) throw new BackupError('backup_unavailable', 'Backups need SERVER_KEK (32-byte hex) on the server', 503);
  return key;
}

function encryptPayload(payload) {
  const plaintext = JSON.stringify(payload);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', backupKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.from(
    `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('base64')}`
  ).toString('base64');
}

function decryptPayload(encryptedBase64) {
  const raw = Buffer.from(encryptedBase64, 'base64').toString('utf8');
  const [ivHex, tagHex, encBase64] = raw.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', backupKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encBase64, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

const sha256 = (value) => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

// ── Workspace metadata collections ───────────────────────────────────────

/**
 * Each restorable collection: how to read it for a set of workspaces, which field
 * names the workspace, and how to check / insert documents.
 */
function collectionDefs() {
  const mongoModel = (load, wsField) => ({
    wsField,
    find: (wsIds) => load().find({ [wsField]: { $in: wsIds } }).lean(),
    existingIds: async (ids) => (await load().find({ _id: { $in: ids } }).select('_id').lean()).map((d) => String(d._id)),
    insert: (docs) => load().insertMany(docs, { ordered: false }),
  });
  const Tasks = () => require('../tasks/tasks.query');
  return {
    channels: mongoModel(() => require('../channels/channel.model'), 'workspace'),
    notes: mongoModel(() => require('../../../models/Note'), 'workspace'),
    knowledgePages: mongoModel(() => require('../knowledge/KnowledgePage'), 'workspaceId'),
    knowledgeCategories: mongoModel(() => require('../knowledge/KnowledgeCategory'), 'workspaceId'),
    files: mongoModel(() => require('../files/WorkspaceFile'), 'workspaceId'),
    tasks: {
      wsField: 'workspace',
      find: (wsIds) => Tasks().find({ workspace: { $in: wsIds } }),
      existingIds: async (ids) => {
        const found = await Promise.all(ids.map((id) => Tasks().findById(id).catch(() => null)));
        return found.filter(Boolean).map((t) => String(t._id));
      },
      insert: async (docs) => { for (const d of docs) await Tasks().create(d); },
    },
  };
}

const COLLECTIONS = ['channels', 'tasks', 'notes', 'knowledgePages', 'knowledgeCategories', 'files'];

async function collectWorkspaceData(workspaceIds, defs = collectionDefs()) {
  const ids = workspaceIds.map(String);
  const out = {};
  for (const name of COLLECTIONS) {
    out[name] = ids.length ? JSON.parse(JSON.stringify(await defs[name].find(ids))) : [];
  }
  return out;
}

async function createBackup({ requesterId, companyId }, deps = {}) {
  const defs = deps.collectionDefs || collectionDefs();
  // Identity tables come from PostgreSQL (secrets never included), audit logs from MongoDB.
  const [identityTables, auditLogs] = await Promise.all([
    (deps.companyBackup || companyBackup)(companyId || null),
    AuditLog.find(companyId ? { companyId } : {})
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean(),
  ]);

  const workspaceIds = (identityTables.workspaces || []).map((w) => String(w.id || w._id));
  const workspaceData = await collectWorkspaceData(workspaceIds, defs);
  const checksums = Object.fromEntries(COLLECTIONS.map((n) => [n, sha256(workspaceData[n])]));

  const backupPayload = {
    format: FORMAT,
    backedUpAt: new Date().toISOString(),
    companyId: companyId || null,
    ...identityTables,
    auditLogs,
    workspaceIds,
    workspaceData,
    checksums,
  };
  const users = identityTables.users;

  const encrypted = encryptPayload(backupPayload);

  const meta = {
    format: FORMAT,
    createdAt: new Date().toISOString(),
    createdBy: requesterId,
    companyId: companyId || null,
    recordCount: {
      users: users.length,
      workspaces: identityTables.workspaces.length,
      departments: identityTables.departments.length,
      teams: identityTables.teams.length,
      auditLogs: auditLogs.length,
      ...Object.fromEntries(COLLECTIONS.map((n) => [n, workspaceData[n].length])),
    },
    algorithm: 'AES-256-GCM',
    checksum: sha256(encrypted),
    encryptedPayload: encrypted,
  };

  await AuditLog.create({
    userId: requesterId,
    companyId: companyId || null,
    action: 'security.backup_created',
    resource: 'Backup',
    description: `Encrypted backup created — ${users.length} users, ${workspaceIds.length} workspaces, ${auditLogs.length} audit logs`,
    details: { recordCount: meta.recordCount, checksum: meta.checksum },
    ipAddress: 'system',
    category: 'security',
    severity: 'info',
  });

  return meta;
}

// ── Verify and restore ───────────────────────────────────────────────────

/** Decrypt and check a backup. Returns the payload or throws BackupError. */
function verifyBackup(encryptedPayload, { checksum } = {}) {
  if (typeof encryptedPayload !== 'string' || !encryptedPayload) throw new BackupError('invalid_backup', 'encryptedPayload is required');
  if (checksum && checksum !== sha256(encryptedPayload)) throw new BackupError('checksum_mismatch', 'The backup file does not match its checksum');
  let payload;
  try {
    payload = decryptPayload(encryptedPayload);
  } catch (err) {
    if (err instanceof BackupError) throw err;
    throw new BackupError('invalid_backup', 'The backup could not be decrypted (wrong server key or corrupted file)');
  }
  const format = payload.format || LEGACY_FORMAT;
  if (format === LEGACY_FORMAT) throw new BackupError('unsupported_format', 'This backup predates workspace data; nothing in it can be restored');
  if (format !== FORMAT) throw new BackupError('unsupported_format', `Unknown backup format ${format}`);
  for (const name of COLLECTIONS) {
    const docs = payload.workspaceData?.[name];
    if (!Array.isArray(docs)) throw new BackupError('invalid_backup', `Backup is missing ${name}`);
    if (sha256(docs) !== payload.checksums?.[name]) throw new BackupError('checksum_mismatch', `Checksum mismatch in ${name}`);
  }
  return payload;
}

/**
 * Restore missing workspace metadata from a backup.
 *   scope: { companyId, isPlatformAdmin }
 *   options: { dryRun = true, collections = all }
 * Returns { dryRun, backup: {...}, collections: { name: { inBackup, existing, toRestore, restored, skipped } } }.
 */
async function restoreBackup({ requesterId, encryptedPayload, checksum, scope, dryRun = true, collections }, deps = {}) {
  const defs = deps.collectionDefs || collectionDefs();
  const identity = deps.identity || require('../../identity');
  const payload = verifyBackup(encryptedPayload, { checksum });

  if (!scope?.isPlatformAdmin) {
    if (!scope?.companyId || String(payload.companyId || '') !== String(scope.companyId)) {
      throw new BackupError('wrong_company', 'This backup belongs to another company', 403);
    }
  }

  const wanted = collections == null ? COLLECTIONS : collections;
  if (!Array.isArray(wanted) || wanted.some((c) => !COLLECTIONS.includes(c))) {
    throw new BackupError('invalid_collections', `collections must be a subset of: ${COLLECTIONS.join(', ')}`);
  }

  // Only workspaces listed in the backup that still exist (and are still in the company) are restorable.
  const backupWs = new Set((payload.workspaceIds || []).map(String));
  const liveRows = await identity.workspaces.findManyByIds([...backupWs]);
  const live = new Set();
  for (const ws of (Array.isArray(liveRows) ? liveRows : [])) {
    const wsCompany = ws?.company || ws?.companyId || null;
    if (scope?.isPlatformAdmin || String(wsCompany || '') === String(scope.companyId)) live.add(String(ws._id || ws.id));
  }

  const report = {};
  for (const name of wanted) {
    const def = defs[name];
    const docs = payload.workspaceData[name];
    const skipped = { workspaceMissing: 0, foreignWorkspace: 0 };
    const candidates = [];
    for (const d of docs) {
      const ws = String(d[def.wsField] || '');
      if (!backupWs.has(ws)) { skipped.foreignWorkspace += 1; continue; }
      if (!live.has(ws)) { skipped.workspaceMissing += 1; continue; }
      candidates.push(d);
    }
    const existing = new Set(candidates.length ? await def.existingIds(candidates.map((d) => String(d._id))) : []);
    const toRestore = candidates.filter((d) => !existing.has(String(d._id)));
    let restored = 0;
    if (!dryRun && toRestore.length) {
      await def.insert(toRestore);
      restored = toRestore.length;
    }
    report[name] = { inBackup: docs.length, existing: existing.size, toRestore: toRestore.length, restored, skipped };
  }

  const totalRestore = Object.values(report).reduce((n, r) => n + r.toRestore, 0);
  await AuditLog.create({
    userId: requesterId,
    companyId: payload.companyId || null,
    action: dryRun ? 'security.backup_restore_dry_run' : 'security.backup_restored',
    resource: 'Backup',
    description: dryRun
      ? `Backup restore dry run — ${totalRestore} document(s) would be restored`
      : `Backup restored — ${totalRestore} document(s) re-created`,
    details: { backedUpAt: payload.backedUpAt, collections: report },
    ipAddress: 'system',
    category: 'security',
    severity: dryRun ? 'info' : 'warning',
  });

  return {
    dryRun: !!dryRun,
    backup: { format: payload.format, backedUpAt: payload.backedUpAt, companyId: payload.companyId || null, workspaces: backupWs.size },
    notRestored: ['identity tables (users, workspaces, members, departments, teams)', 'audit logs', 'messages (never backed up: end-to-end encrypted)'],
    collections: report,
  };
}

module.exports = {
  FORMAT,
  COLLECTIONS,
  BackupError,
  createBackup,
  verifyBackup,
  restoreBackup,
  encryptPayload,
  decryptPayload,
  collectWorkspaceData,
  sha256,
};
