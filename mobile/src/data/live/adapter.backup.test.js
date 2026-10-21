import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = [];
let reply = {};
vi.mock('./http.js', () => {
  const record = (method) => async (path, a, b) => {
    calls.push({ method, path, a, b });
    return typeof reply === 'function' ? reply(method, path) : reply;
  };
  return { api: { get: record('GET'), post: record('POST'), put: record('PUT'), patch: record('PATCH'), del: record('DELETE') } };
});

vi.mock('../../native/index.js', () => ({ closeBrowser: vi.fn() }));

const { backupAdapter, mapBackupStatus } = await import('./adapter.backup.js');
const { finishBackupLink, restoreRows, shouldOfferRestore, statusSummary, formatBytes } = await import('../../features/settings/backupInfo.js');
const { on } = await import('../../lib/bus.js');
const native = await import('../../native/index.js');

beforeEach(() => {
  calls.length = 0;
  reply = {};
});

describe('Google Drive backup adapter', () => {
  it('maps the status', () => {
    const s = mapBackupStatus({ configured: true, connected: true, googleEmail: 'ada@gmail.com', lastBackupAt: '2026-10-21T08:00:00Z', lastBackupSize: '48211', status: 'ok' });
    expect(s).toMatchObject({ configured: true, connected: true, googleEmail: 'ada@gmail.com', lastBackupSize: 48211, autoBackup: true, hold: null });
    expect(s.lastBackupAt).toBeInstanceOf(Date);
    expect(mapBackupStatus({})).toMatchObject({ configured: false, connected: false, lastBackupAt: null });
  });

  it('calls the backup endpoints', async () => {
    reply = { configured: true, connected: true };
    await backupAdapter.backupStatus({ offer: true });
    await backupAdapter.backupConnect('app');
    await backupAdapter.backupSetAuto(false);
    await backupAdapter.backupRun();
    await backupAdapter.backupPreview();
    await backupAdapter.backupRestore();
    await backupAdapter.backupDisconnect({ deleteBackup: true });
    expect(calls.map((c) => [c.method, c.path, c.a])).toEqual([
      ['GET', '/v2/backup/status', { offer: 1 }],
      ['POST', '/v2/backup/google/connect', { client: 'app' }],
      ['PATCH', '/v2/backup/settings', { autoBackup: false }],
      ['POST', '/v2/backup/run', undefined],
      ['GET', '/v2/backup/restore/preview', undefined],
      ['POST', '/v2/backup/restore', { confirm: true }],
      ['POST', '/v2/backup/disconnect', { deleteBackup: true }],
    ]);
  });
});

describe('backup screen helpers', () => {
  it('handles oruinwan://backup links and leaves others alone', () => {
    const seen = [];
    const off = on('backup:returned', (r) => seen.push(r));
    expect(finishBackupLink('oruinwan://sso?code=abc')).toBe(false);
    expect(finishBackupLink('https://oruinwan.example/join?token=x')).toBe(false);
    expect(finishBackupLink('oruinwan://backup?result=connected')).toBe(true);
    expect(native.closeBrowser).toHaveBeenCalled();
    expect(seen).toEqual(['connected']);
    off();
  });

  it('offers a restore only for a connected, empty account with a backup', () => {
    const base = { configured: true, connected: true, lastBackupAt: new Date(), accountLooksEmpty: true };
    expect(shouldOfferRestore(base)).toBe(true);
    expect(shouldOfferRestore({ ...base, accountLooksEmpty: false })).toBe(false);
    expect(shouldOfferRestore({ ...base, connected: false })).toBe(false);
  });

  it('summarises status and restore plans', () => {
    expect(statusSummary({ connected: true, status: 'reauth' }).tone).toBe('danger');
    expect(statusSummary({ connected: true, status: 'ok', hold: 'account-empty', lastBackupAt: new Date() }).tone).toBe('warning');
    expect(restoreRows({ sections: { tasks: { inBackup: 2, present: 1, restore: 1, skipped: 0 }, files: { inBackup: 0, restore: 0 } } }).map((r) => r.key)).toEqual(['tasks']);
    expect(formatBytes(2048)).toBe('2.0 KB');
  });
});
