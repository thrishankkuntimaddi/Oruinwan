'use strict';

process.env.SERVER_KEK = 'ab'.repeat(32);

jest.mock('../../../../models/AuditLog', () => ({
  create: jest.fn().mockResolvedValue({}),
  find: jest.fn(() => ({ sort: () => ({ limit: () => ({ lean: async () => [{ _id: 'log1', action: 'x' }] }) }) })),
}));

const AuditLog = require('../../../../models/AuditLog');
const backup = require('../backup.service');

const C1 = 'c1';
const WS1 = 'w1';
const WS2 = 'w2';

/** In-memory collections standing in for the Mongo models / task store. */
function fakeDefs(initial) {
  const db = JSON.parse(JSON.stringify(initial));
  const wsField = { channels: 'workspace', tasks: 'workspace', notes: 'workspace', knowledgePages: 'workspaceId', knowledgeCategories: 'workspaceId', files: 'workspaceId' };
  const defs = {};
  for (const name of backup.COLLECTIONS) {
    db[name] = db[name] || [];
    defs[name] = {
      wsField: wsField[name],
      find: async (wsIds) => db[name].filter((d) => wsIds.includes(d[wsField[name]])),
      existingIds: async (ids) => db[name].filter((d) => ids.includes(d._id)).map((d) => d._id),
      insert: jest.fn(async (docs) => { db[name].push(...docs); }),
    };
  }
  return { db, defs };
}

const identityTables = () => ({
  companies: [{ id: C1 }], users: [{ _id: 'u1' }], workspaces: [{ id: WS1 }, { id: WS2 }],
  workspaceMembers: [], departments: [], teams: [],
});

const seed = {
  channels: [{ _id: 'ch1', workspace: WS1, name: 'general' }, { _id: 'ch2', workspace: WS2, name: 'eng' }],
  tasks: [{ _id: 't1', workspace: WS1, title: 'Ship' }],
  notes: [{ _id: 'n1', workspace: WS1, title: 'Plan' }],
  knowledgePages: [{ _id: 'k1', workspaceId: WS2, title: 'Wiki' }],
  knowledgeCategories: [],
  files: [{ _id: 'f1', workspaceId: WS1, name: 'a.pdf' }],
};

async function makeBackup() {
  const { defs } = fakeDefs(seed);
  return backup.createBackup({ requesterId: 'admin', companyId: C1 }, { collectionDefs: defs, companyBackup: async () => identityTables() });
}

const liveIdentity = (rows) => ({ workspaces: { findManyByIds: async (ids) => rows.filter((r) => ids.includes(r._id)) } });

describe('encrypted backups', () => {
  test('include workspace metadata, never messages, with checksums', async () => {
    const meta = await makeBackup();
    expect(meta.format).toBe('oruinwan-backup-v2');
    expect(meta.recordCount).toMatchObject({ channels: 2, tasks: 1, notes: 1, knowledgePages: 1, files: 1, workspaces: 2 });
    expect(meta.checksum).toBe(backup.sha256(meta.encryptedPayload));
    const payload = backup.decryptPayload(meta.encryptedPayload);
    expect(payload.messages).toBeUndefined();
    expect(Object.keys(payload.workspaceData).sort()).toEqual([...backup.COLLECTIONS].sort());
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'security.backup_created' }));
  });

  test('verify rejects tampering, bad checksums and wrong keys', async () => {
    const meta = await makeBackup();
    expect(() => backup.verifyBackup(meta.encryptedPayload, { checksum: meta.checksum })).not.toThrow();
    expect(() => backup.verifyBackup(meta.encryptedPayload, { checksum: 'nope' })).toThrow(expect.objectContaining({ code: 'checksum_mismatch' }));

    const raw = Buffer.from(meta.encryptedPayload, 'base64').toString('utf8').split(':');
    raw[2] = Buffer.from('tampered').toString('base64');
    expect(() => backup.verifyBackup(Buffer.from(raw.join(':')).toString('base64'))).toThrow(expect.objectContaining({ code: 'invalid_backup' }));

    // A payload re-encrypted with a forged collection but stale checksum.
    const payload = backup.decryptPayload(meta.encryptedPayload);
    payload.workspaceData.channels.push({ _id: 'evil', workspace: WS1 });
    expect(() => backup.verifyBackup(backup.encryptPayload(payload))).toThrow(expect.objectContaining({ code: 'checksum_mismatch' }));

    const legacy = backup.encryptPayload({ backedUpAt: 'x', users: [] });
    expect(() => backup.verifyBackup(legacy)).toThrow(expect.objectContaining({ code: 'unsupported_format' }));
  });

  test('no server key: a clear 503', () => {
    const saved = process.env.SERVER_KEK;
    process.env.SERVER_KEK = '';
    try {
      expect(() => backup.encryptPayload({})).toThrow(expect.objectContaining({ status: 503, code: 'backup_unavailable' }));
    } finally {
      process.env.SERVER_KEK = saved;
    }
  });
});

describe('restore', () => {
  test('dry run reports what is missing and writes nothing', async () => {
    const meta = await makeBackup();
    // Live data lost ch1 and t1; WS2 was deleted entirely.
    const { db, defs } = fakeDefs({ ...seed, channels: [seed.channels[1]], tasks: [] });
    const result = await backup.restoreBackup({
      requesterId: 'admin', encryptedPayload: meta.encryptedPayload, scope: { companyId: C1 }, dryRun: true,
    }, { collectionDefs: defs, identity: liveIdentity([{ _id: WS1, company: C1 }]) });

    expect(result.dryRun).toBe(true);
    expect(result.collections.channels).toMatchObject({ inBackup: 2, toRestore: 1, restored: 0, skipped: { workspaceMissing: 1 } });
    expect(result.collections.tasks).toMatchObject({ toRestore: 1, restored: 0 });
    expect(result.collections.knowledgePages.skipped.workspaceMissing).toBe(1);
    expect(defs.channels.insert).not.toHaveBeenCalled();
    expect(db.channels).toHaveLength(1);
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'security.backup_restore_dry_run' }));
  });

  test('real restore re-creates only missing documents', async () => {
    const meta = await makeBackup();
    const { db, defs } = fakeDefs({ ...seed, channels: [], notes: [] });
    const result = await backup.restoreBackup({
      requesterId: 'admin', encryptedPayload: meta.encryptedPayload, scope: { companyId: C1 }, dryRun: false, collections: ['channels', 'notes'],
    }, { collectionDefs: defs, identity: liveIdentity([{ _id: WS1, company: C1 }, { _id: WS2, company: C1 }]) });

    expect(result.collections.channels.restored).toBe(2);
    expect(result.collections.notes.restored).toBe(1);
    expect(result.collections.tasks).toBeUndefined();
    expect(db.channels.map((c) => c._id).sort()).toEqual(['ch1', 'ch2']);
    expect(defs.tasks.insert).not.toHaveBeenCalled();
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'security.backup_restored' }));
  });

  test('a company admin cannot restore another company\'s backup or into moved workspaces', async () => {
    const meta = await makeBackup();
    const { defs } = fakeDefs({});
    await expect(backup.restoreBackup({ requesterId: 'x', encryptedPayload: meta.encryptedPayload, scope: { companyId: 'other' } }, { collectionDefs: defs, identity: liveIdentity([]) }))
      .rejects.toMatchObject({ code: 'wrong_company', status: 403 });

    // WS1 now belongs to another company: its documents are skipped.
    const r = await backup.restoreBackup({ requesterId: 'x', encryptedPayload: meta.encryptedPayload, scope: { companyId: C1 } },
      { collectionDefs: defs, identity: liveIdentity([{ _id: WS1, company: 'other' }]) });
    expect(r.collections.channels.toRestore).toBe(0);
  });

  test('rejects unknown collections', async () => {
    const meta = await makeBackup();
    const { defs } = fakeDefs({});
    await expect(backup.restoreBackup({ requesterId: 'x', encryptedPayload: meta.encryptedPayload, scope: { companyId: C1 }, collections: ['messages'] },
      { collectionDefs: defs, identity: liveIdentity([]) })).rejects.toMatchObject({ code: 'invalid_collections' });
  });
});
