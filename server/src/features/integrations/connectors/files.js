'use strict';

/**
 * File storage connectors: Google Drive, OneDrive (Microsoft Graph) and
 * Dropbox. Each offers `search` (browse when q is empty) and `item` (one file's
 * metadata, used to attach a link to a task). Messages get links from the
 * client, which puts the URL into the (end-to-end encrypted) message itself.
 *
 * Item: { id, title, url, kind: 'file'|'folder', mimeType, modifiedAt, owner, path }
 */

const { request, clip, httpError } = require('./http');
const google = require('./google');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const driveApi = () => (process.env.GOOGLE_DRIVE_API_URL || 'https://www.googleapis.com/drive/v3').replace(/\/+$/, '');
const graphApi = () => (process.env.MS_GRAPH_API_URL || 'https://graph.microsoft.com/v1.0').replace(/\/+$/, '');
const dropboxApi = () => (process.env.DROPBOX_API_URL || 'https://api.dropboxapi.com/2').replace(/\/+$/, '');

const ID_RE = /^[A-Za-z0-9_!:.@%-]{1,300}$/;
function checkId(id) {
  if (!ID_RE.test(String(id || ''))) throw httpError(400, 'Invalid item id');
  return String(id);
}

/* ── Google Drive ─────────────────────────────────────────────────────── */

const DRIVE_FIELDS = 'id,name,mimeType,webViewLink,modifiedTime,owners(displayName),iconLink';
const driveItem = (f) => ({
  id: f.id, title: f.name, url: f.webViewLink || `https://drive.google.com/open?id=${f.id}`,
  kind: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file', mimeType: f.mimeType || null,
  modifiedAt: f.modifiedTime || null, owner: f.owners?.[0]?.displayName || null, path: null,
});

async function drive(ctx, path, params) {
  return request({
    label: 'Google Drive', code: 'GDRIVE', method: 'get', url: `${driveApi()}${path}`, params,
    headers: { Authorization: `Bearer ${await google.bearer(ctx, DRIVE_SCOPE)}` },
  });
}

const googleDrive = {
  type: 'google_drive',
  label: 'Google Drive',
  category: 'files',
  description: 'Search Drive files and attach them to messages and tasks.',
  setup: [
    'Either: create a service account in Google Cloud (IAM → Service accounts → Keys → Add key → JSON), enable the Drive API, and share the folders your team uses with the service account’s e-mail. Paste the whole JSON key below. This keeps working.',
    'Or: paste an OAuth access token with the drive.readonly scope (for example from the Google OAuth 2.0 Playground). Access tokens expire after about an hour, so use this for trying it out.',
    'A Google API key does not work: it cannot see private files.',
  ],
  form: [
    { key: 'serviceAccount', label: 'Service account key (JSON)', kind: 'textarea', secret: true, placeholder: '{ "type": "service_account", … }' },
    { key: 'accessToken', label: 'or OAuth access token', kind: 'secret', placeholder: 'ya29.…' },
  ],
  secrets: ['accessToken', 'serviceAccount'],
  generated: [],
  secretChecks: { accessToken: google.checkAccessToken, serviceAccount: (v) => { google.parseServiceAccount(v); } },
  fields: {},
  defaults: () => ({}),
  toggles: [],
  routes: null,
  isConfigured: (c) => !!(c.accessToken || c.serviceAccount),
  webhook: null,
  async test(ctx) {
    const about = await drive(ctx, '/about', { fields: 'user(displayName,emailAddress)' });
    return { account: { name: about.user?.displayName || null, email: about.user?.emailAddress || null } };
  },
  actions: {
    search: {
      method: 'GET',
      async run(ctx, { q, folder }) {
        const parts = ['trashed = false'];
        if (q) parts.push(`name contains '${clip(q, 100).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`);
        if (folder) parts.push(`'${checkId(folder)}' in parents`);
        const r = await drive(ctx, '/files', {
          q: parts.join(' and '), pageSize: 25, orderBy: q ? undefined : 'modifiedTime desc',
          fields: `files(${DRIVE_FIELDS})`, supportsAllDrives: true, includeItemsFromAllDrives: true,
        });
        return { items: (r.files || []).map(driveItem) };
      },
    },
    item: {
      method: 'GET',
      async run(ctx, { id }) {
        return { item: driveItem(await drive(ctx, `/files/${encodeURIComponent(checkId(id))}`, { fields: DRIVE_FIELDS, supportsAllDrives: true })) };
      },
    },
  },
};

/* ── OneDrive (Microsoft Graph) ───────────────────────────────────────── */

const graphItem = (f) => ({
  id: f.id, title: f.name, url: f.webUrl || null, kind: f.folder ? 'folder' : 'file', mimeType: f.file?.mimeType || null,
  modifiedAt: f.lastModifiedDateTime || null, owner: f.createdBy?.user?.displayName || null,
  path: f.parentReference?.path ? String(f.parentReference.path).replace(/^\/drive\/root:?/, '') || '/' : null,
});

function graph(ctx, path, params) {
  return request({
    label: 'OneDrive', code: 'ONEDRIVE', method: 'get', url: `${graphApi()}${path}`, params,
    headers: { Authorization: `Bearer ${ctx.secret('accessToken')}`, Accept: 'application/json' },
  });
}

const onedrive = {
  type: 'onedrive',
  label: 'OneDrive',
  category: 'files',
  description: 'Search OneDrive / SharePoint files and attach them to messages and tasks.',
  setup: [
    'Get a Microsoft Graph access token with Files.Read.All (for example from Graph Explorer → Access token tab) and paste it below.',
    'Graph tokens expire after about an hour; paste a fresh one when Oruinwan says it was rejected.',
  ],
  form: [{ key: 'accessToken', label: 'Microsoft Graph access token', kind: 'secret', required: true, placeholder: 'eyJ0eXAi…' }],
  secrets: ['accessToken'],
  generated: [],
  fields: {},
  defaults: () => ({}),
  toggles: [],
  routes: null,
  required: ['accessToken'],
  webhook: null,
  async test(ctx) {
    const me = await graph(ctx, '/me', { $select: 'displayName,mail,userPrincipalName' });
    return { account: { name: me.displayName || null, email: me.mail || me.userPrincipalName || null } };
  },
  actions: {
    search: {
      method: 'GET',
      async run(ctx, { q, folder }) {
        let r;
        if (q) r = await graph(ctx, `/me/drive/root/search(q='${encodeURIComponent(clip(q, 100).replace(/'/g, "''"))}')`, { $top: 25 });
        else if (folder) r = await graph(ctx, `/me/drive/items/${encodeURIComponent(checkId(folder))}/children`, { $top: 50 });
        else r = await graph(ctx, '/me/drive/root/children', { $top: 50, $orderby: 'lastModifiedDateTime desc' });
        return { items: (r.value || []).map(graphItem) };
      },
    },
    item: {
      method: 'GET',
      async run(ctx, { id }) {
        return { item: graphItem(await graph(ctx, `/me/drive/items/${encodeURIComponent(checkId(id))}`)) };
      },
    },
  },
};

/* ── Dropbox ──────────────────────────────────────────────────────────── */

function dbx(ctx, path, data) {
  return request({
    label: 'Dropbox', code: 'DROPBOX', method: 'post', url: `${dropboxApi()}${path}`, data: data === undefined ? 'null' : data,
    headers: { Authorization: `Bearer ${ctx.secret('accessToken')}`, 'Content-Type': 'application/json' },
  });
}

const dropboxItem = (m) => ({
  id: m.id, title: m.name, url: `https://www.dropbox.com/home${encodeURI(m.path_display || '')}`,
  kind: m['.tag'] === 'folder' ? 'folder' : 'file', mimeType: null, modifiedAt: m.server_modified || null, owner: null, path: m.path_display || null,
});

/** A shared link for the file (created if there is none), so teammates can open it. */
async function dropboxLink(ctx, path) {
  try {
    const r = await dbx(ctx, '/sharing/create_shared_link_with_settings', { path });
    return r.url;
  } catch (err) {
    if (err.code !== 'DROPBOX_INVALID') throw err;
    const r = await dbx(ctx, '/sharing/list_shared_links', { path, direct_only: true });
    return r.links?.[0]?.url || null;
  }
}

const dropbox = {
  type: 'dropbox',
  label: 'Dropbox',
  category: 'files',
  description: 'Search Dropbox files and attach shared links to messages and tasks.',
  setup: [
    'Create an app at dropbox.com/developers/apps (Scoped access, Full Dropbox or App folder) with files.metadata.read, sharing.read and sharing.write permissions.',
    'On the app’s Settings tab press "Generate" under Generated access token and paste it below.',
  ],
  form: [{ key: 'accessToken', label: 'Generated access token', kind: 'secret', required: true, placeholder: 'sl.…' }],
  secrets: ['accessToken'],
  generated: [],
  fields: {},
  defaults: () => ({}),
  toggles: [],
  routes: null,
  required: ['accessToken'],
  webhook: null,
  async test(ctx) {
    const me = await dbx(ctx, '/users/get_current_account');
    return { account: { name: me.name?.display_name || null, email: me.email || null } };
  },
  actions: {
    search: {
      method: 'GET',
      async run(ctx, { q, folder }) {
        if (q) {
          const r = await dbx(ctx, '/files/search_v2', { query: clip(q, 100), options: { max_results: 25 } });
          return { items: (r.matches || []).map(m => m.metadata?.metadata).filter(Boolean).map(dropboxItem) };
        }
        const path = folder ? (String(folder).startsWith('id:') ? checkId(folder) : String(folder).slice(0, 500)) : '';
        const r = await dbx(ctx, '/files/list_folder', { path, limit: 50 });
        return { items: (r.entries || []).map(dropboxItem) };
      },
    },
    item: {
      method: 'GET',
      async run(ctx, { id }) {
        const meta = await dbx(ctx, '/files/get_metadata', { path: String(id).startsWith('id:') ? checkId(id) : `id:${checkId(id)}` });
        const item = dropboxItem(meta);
        if (item.kind === 'file') item.url = (await dropboxLink(ctx, meta.path_lower || meta.id).catch(() => null)) || item.url;
        return { item };
      },
    },
  },
};

module.exports = { googleDrive, onedrive, dropbox };
