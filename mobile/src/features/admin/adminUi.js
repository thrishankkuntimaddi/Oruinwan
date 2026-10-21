// Admin helpers, free of React.

export const isWorkspaceAdmin = (workspace) => ['owner', 'admin'].includes(workspace?.role);
export const isCompanyAdmin = (ctx) => ['owner', 'admin', 'co-owner', 'co_owner'].includes(ctx?.companyRole);

/** Org chart roots → [{ node, depth }] for the indented phone list (depth-first). */
export function flattenTree(roots, depth = 0, out = []) {
  for (const n of roots || []) {
    out.push({ node: n, depth });
    flattenTree(n.reports, depth + 1, out);
  }
  return out;
}

/** Counts every person in the tree. */
export const treeSize = (roots) => flattenTree(roots).length;

/** The matrix row with one permission flipped (rows are saved whole). */
export function toggleCell(matrix, role, key) {
  const row = { ...(matrix?.[role] || {}) };
  row[key] = !row[key];
  return row;
}

export const PERMISSION_LABELS = {
  manageCompany: 'Manage company',
  viewAnalytics: 'View analytics',
  manageBilling: 'Manage billing',
  inviteUsers: 'Invite people',
  removeUsers: 'Remove people',
  manageRoles: 'Manage roles',
  createWorkspace: 'Create workspaces',
  deleteWorkspace: 'Delete workspaces',
  manageWorkspaceMembers: 'Manage workspace members',
  createChannel: 'Create channels',
  deleteChannel: 'Delete channels',
  manageChannelMembers: 'Manage channel members',
  sendMessages: 'Send messages',
  deleteMessages: 'Delete messages',
  pinMessages: 'Pin messages',
  createTasks: 'Create tasks',
  assignTasks: 'Assign tasks',
  deleteTasks: 'Delete tasks',
  createNotes: 'Create notes',
  shareNotes: 'Share notes',
  postUpdates: 'Post updates',
  deleteUpdates: 'Delete updates',
};

export const MATRIX_ROLES = ['owner', 'admin', 'manager', 'member', 'guest'];

export const FEATURE_LABELS = {
  tasks: ['Tasks', 'Task lists, boards and planning'],
  notes: ['Notes', 'Personal and shared notes'],
  polls: ['Polls', 'Quick votes in conversations'],
  ai: ['Oruinwan AI', 'The assistant and @ai in chats'],
  huddles: ['Huddles', 'Voice calls in channels and DMs'],
  fileUploads: ['File uploads', 'Sharing files and photos'],
  reactions: ['Reactions', 'Emoji reactions on messages'],
  threads: ['Threads', 'Replies in threads'],
  bookmarks: ['Bookmarks', 'Saved messages'],
  reminders: ['Reminders', 'Reminders on messages and tasks'],
};

/** "oruinwan-<name>-2026-03-03.json" */
export function exportFileName(name, now = new Date()) {
  const slug = String(name || 'workspace').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `oruinwan-${slug}-${d}.json`;
}

/** Parses a pasted or picked workspace export. Throws a readable error. */
export function parseBundle(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That isn't a workspace export (not valid JSON).");
  }
  const bundle = data?.bundle || data;
  if (!bundle || typeof bundle !== 'object' || !bundle.workspace || !bundle.schemaVersion) {
    throw new Error("That isn't a workspace export from Oruinwan.");
  }
  return bundle;
}

/** "workspace.created" → "Workspace created". */
export function actionLabel(action) {
  const s = String(action || 'event').replace(/[._:]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
