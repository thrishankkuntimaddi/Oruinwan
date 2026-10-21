// Words and helpers for Settings → Backup (Google Drive). Same copy as the web app
// (client/src/pages/settingsTabs/backupInfo.js); the contract is docs/api/backup.md.
import { closeBrowser } from '../../native/index.js';
import { emit, toast } from '../../lib/bus.js';

export const INCLUDED = [
  ['Profile & settings', 'Your name, job title, profile and preferences'],
  ['Encryption keys', 'Your identity key (still locked by your password or account) and your conversation keys'],
  ['Workspaces', 'Which workspaces you belong to'],
  ['Notes', 'Notes you own, notes shared with you, and notes of meetings you were in'],
  ['Tasks', 'Tasks you created or are assigned to'],
  ['Knowledge', 'Pages you wrote'],
  ['Meetings', 'Meetings you organised or were invited to: details, summary, action items'],
  ['Messages', 'Messages you sent, still end-to-end encrypted'],
  ['Files', 'The list of files you uploaded (names, sizes), not the files themselves'],
];

export const NOT_INCLUDED = 'File contents, other people’s messages, recordings and transcripts, and workspace or company settings.';

export const RESTORE_RULES =
  'Restoring adds back what you own that is missing. It never overwrites or duplicates anything, never brings back other people’s content, and only restores into workspaces and conversations you are still in.';

export const SECTION_LABELS = {
  profile: 'Profile & settings',
  keys: 'Encryption keys',
  conversationKeys: 'Conversation keys',
  workspaces: 'Workspaces',
  notes: 'Notes',
  tasks: 'Tasks',
  knowledge: 'Knowledge pages',
  meetings: 'Meetings',
  messages: 'Messages you sent',
  files: 'Files (list only)',
};

export function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(v < 10 * 1024 ? 1 : 0)} KB`;
  if (v < 1024 * 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`;
  return `${(v / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** [message, tone] after Google sent the person back. */
export function connectResultMessage(result) {
  switch (result) {
    case 'connected':
      return ['Google Drive is connected. Your first backup is on its way.', 'success'];
    case 'found':
      return ['Google Drive is connected. This account already has a backup. Restore it, or back up now to replace it.', 'neutral'];
    case 'denied':
      return ['Google Drive was not connected.', 'neutral'];
    case 'scope_denied':
      return ['Oruinwan needs permission to keep its backup in your Drive. Try again and leave that box ticked.', 'danger'];
    case 'expired':
      return ['That sign-in took too long. Try connecting again.', 'danger'];
    default:
      return ['Google Drive could not be connected. Try again.', 'danger'];
  }
}

export function statusSummary(s) {
  if (!s?.connected) return null;
  if (s.status === 'running') return { tone: 'info', text: 'Backing up now…' };
  if (s.status === 'reauth') return { tone: 'danger', text: 'Google access was removed. Connect Google Drive again to keep backing up.' };
  if (s.status === 'error') return { tone: 'danger', text: `The last backup failed${s.lastError ? `: ${s.lastError}` : '.'}` };
  if (s.hold === 'existing-backup')
    return { tone: 'warning', text: 'This Google account already had a backup. Automatic backup waits until you restore it or back up now (which replaces it).' };
  if (s.hold === 'account-empty')
    return { tone: 'warning', text: 'Your account looks empty, so automatic backup paused to keep your last backup safe. Restore it, or back up now to replace it.' };
  if (!s.lastBackupAt) return { tone: 'info', text: 'No backup yet.' };
  return null;
}

export function restoreRows(plan) {
  const sections = plan?.sections || {};
  return Object.keys(SECTION_LABELS)
    .filter((k) => sections[k] && (sections[k].inBackup || sections[k].restore))
    .map((k) => ({ key: k, label: SECTION_LABELS[k], ...sections[k] }));
}

export function restoreSummary(plan) {
  const n = plan?.total || 0;
  if (!n) return 'Everything in this backup is already in your account. There is nothing to restore.';
  return `${n} item${n === 1 ? '' : 's'} will be added back.`;
}

/** Offer a restore after sign-in: connected, a backup exists, and the account looks empty. */
export function shouldOfferRestore(s) {
  return Boolean(s?.configured && s.connected && s.lastBackupAt && s.accountLooksEmpty);
}

/**
 * oruinwan://backup?result=… — Google sent the phone back after connecting Drive.
 * Returns false for any other link so App.jsx can try the next handler.
 */
export function finishBackupLink(link) {
  const text = String(link || '');
  if (!/^oruinwan(-[a-z]+)?:\/\/backup\b/i.test(text)) return false;
  let result = 'failed';
  try {
    result = new URL(text).searchParams.get('result') || 'failed';
  } catch {
    /* malformed: report a failure */
  }
  closeBrowser();
  const [message, tone] = connectResultMessage(result);
  toast(message, tone);
  emit('backup:returned', result);
  return true;
}
