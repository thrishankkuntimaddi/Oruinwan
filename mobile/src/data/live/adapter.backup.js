// Live adapter part: Google Drive backup (docs/api/backup.md). Merged into liveAdapter
// (adapter.js), so screens call these through api().
//
//   GET   /v2/backup/status[?offer=1]     PATCH /v2/backup/settings { autoBackup }
//   POST  /v2/backup/google/connect       POST  /v2/backup/run
//   GET   /v2/backup/restore/preview      POST  /v2/backup/restore { confirm: true }
//   POST  /v2/backup/disconnect { deleteBackup }
import { api } from './http.js';

/** The server's status, with dates as Date objects. */
export function mapBackupStatus(s = {}) {
  return {
    configured: Boolean(s.configured),
    connected: Boolean(s.connected),
    googleEmail: s.googleEmail || null,
    autoBackup: s.autoBackup !== false,
    status: s.status || 'idle',
    lastError: s.lastError || null,
    hold: s.hold || null,
    lastBackupAt: s.lastBackupAt ? new Date(s.lastBackupAt) : null,
    lastBackupSize: Number(s.lastBackupSize) || 0,
    lastCounts: s.lastCounts || null,
    connectedAt: s.connectedAt ? new Date(s.connectedAt) : null,
    fileName: s.fileName || 'oruinwan-backup.bin',
    accountLooksEmpty: Boolean(s.accountLooksEmpty),
    deleted: Boolean(s.deleted),
  };
}

export const backupAdapter = {
  async backupStatus({ offer = false } = {}) {
    return mapBackupStatus(await api.get('/v2/backup/status', offer ? { offer: 1 } : undefined));
  },
  /** { url } of Google's consent page. `client`: 'app' returns to oruinwan://backup, 'desktop' ends on a "close this window" page. */
  async backupConnect(client) {
    return api.post('/v2/backup/google/connect', { client });
  },
  async backupSetAuto(on) {
    return mapBackupStatus(await api.patch('/v2/backup/settings', { autoBackup: Boolean(on) }));
  },
  async backupRun() {
    return mapBackupStatus(await api.post('/v2/backup/run'));
  },
  async backupPreview() {
    return api.get('/v2/backup/restore/preview');
  },
  async backupRestore() {
    return api.post('/v2/backup/restore', { confirm: true });
  },
  async backupDisconnect({ deleteBackup = false } = {}) {
    return mapBackupStatus(await api.post('/v2/backup/disconnect', { deleteBackup: Boolean(deleteBackup) }));
  },
};
