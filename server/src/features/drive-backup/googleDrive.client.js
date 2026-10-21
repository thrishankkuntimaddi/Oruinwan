'use strict';

/**
 * Google OAuth + Drive v3 calls for backups. Only the hidden per-app folder is used
 * (scope drive.appdata, `spaces=appDataFolder`): files there never show in the person's
 * Drive, and this app can't see anything else in their Drive.
 *
 * Every call goes through `http` (axios by default) so tests can swap it.
 */

const axios = require('axios');

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.appdata'];
const FILE_NAME = 'oruinwan-backup.bin';

const urls = (env = process.env) => ({
    auth: env.GOOGLE_OAUTH_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth',
    token: env.GOOGLE_OAUTH_TOKEN_URL || 'https://oauth2.googleapis.com/token',
    revoke: env.GOOGLE_OAUTH_REVOKE_URL || 'https://oauth2.googleapis.com/revoke',
    drive: (env.GOOGLE_DRIVE_API_URL || 'https://www.googleapis.com/drive/v3').replace(/\/+$/, ''),
    upload: (env.GOOGLE_DRIVE_UPLOAD_URL || 'https://www.googleapis.com/upload/drive/v3').replace(/\/+$/, ''),
});

let http = axios;
function _setHttpForTests(client) { http = client || axios; }

/** OAuth client used for backups: GOOGLE_BACKUP_CLIENT_* or the web sign-in client. */
function oauthConfig(env = process.env) {
    const clientId = env.GOOGLE_BACKUP_CLIENT_ID || env.GOOGLE_CLIENT_ID || '';
    const clientSecret = env.GOOGLE_BACKUP_CLIENT_ID ? env.GOOGLE_BACKUP_CLIENT_SECRET : env.GOOGLE_CLIENT_SECRET;
    const backend = (env.BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '');
    return {
        configured: Boolean(clientId && clientSecret),
        clientId,
        clientSecret: clientSecret || '',
        redirectUri: env.GOOGLE_BACKUP_REDIRECT_URI || `${backend}/api/v2/backup/google/callback`,
    };
}

function driveError(err, what) {
    const status = err.response?.status;
    const reason = err.response?.data?.error?.message || err.response?.data?.error_description || err.response?.data?.error || err.message;
    const e = new Error(`Google Drive ${what} failed: ${typeof reason === 'string' ? reason : 'unknown error'}`);
    e.status = status;
    // invalid_grant: the person revoked access or the token expired; they must connect again.
    e.code = err.response?.data?.error === 'invalid_grant' ? 'DRIVE_REAUTH' : (status === 404 ? 'DRIVE_NOT_FOUND' : 'DRIVE_ERROR');
    return e;
}

function authUrl({ state, loginHint } = {}, env = process.env) {
    const cfg = oauthConfig(env);
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        scope: SCOPES.join(' '),
        access_type: 'offline',
        // consent: Google returns a refresh token every time, also when switching back to an account.
        prompt: 'consent select_account',
        include_granted_scopes: 'false',
        state,
    });
    if (loginHint) params.set('login_hint', loginHint);
    return `${urls(env).auth}?${params.toString()}`;
}

/** The Google account email from an id_token received straight from Google's token endpoint over TLS. */
function emailFromIdToken(idToken) {
    try {
        const payload = JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8'));
        return payload.email || null;
    } catch {
        return null;
    }
}

const form = (o) => new URLSearchParams(o).toString();
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };

/** Swap the authorization code for tokens: { refreshToken, accessToken, email, scope }. */
async function exchangeCode(code, env = process.env) {
    const cfg = oauthConfig(env);
    try {
        const res = await http.post(urls(env).token, form({
            code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri, grant_type: 'authorization_code',
        }), { headers: FORM, timeout: 15_000 });
        const d = res.data || {};
        return { refreshToken: d.refresh_token || null, accessToken: d.access_token, email: emailFromIdToken(d.id_token), scope: d.scope || '' };
    } catch (err) {
        throw driveError(err, 'sign-in');
    }
}

async function accessToken(refreshToken, env = process.env) {
    const cfg = oauthConfig(env);
    try {
        const res = await http.post(urls(env).token, form({
            refresh_token: refreshToken, client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'refresh_token',
        }), { headers: FORM, timeout: 15_000 });
        if (!res.data?.access_token) throw new Error('no access token');
        return res.data.access_token;
    } catch (err) {
        throw driveError(err, 'authorization');
    }
}

async function revoke(token, env = process.env) {
    try {
        await http.post(urls(env).revoke, form({ token }), { headers: FORM, timeout: 10_000 });
        return true;
    } catch {
        return false; // already revoked or expired: nothing left to do
    }
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

/** Our backup files in appDataFolder (normally zero or one). */
async function findBackupFiles(token, env = process.env) {
    try {
        const res = await http.get(`${urls(env).drive}/files`, {
            headers: bearer(token),
            params: { spaces: 'appDataFolder', q: `name = '${FILE_NAME}' and trashed = false`, fields: 'files(id,name,size,modifiedTime)', pageSize: 10 },
            timeout: 15_000,
        });
        return res.data?.files || [];
    } catch (err) {
        throw driveError(err, 'listing');
    }
}

async function getFileMeta(token, fileId, env = process.env) {
    try {
        const res = await http.get(`${urls(env).drive}/files/${encodeURIComponent(fileId)}`, {
            headers: bearer(token), params: { fields: 'id,name,size,modifiedTime' }, timeout: 15_000,
        });
        return res.data;
    } catch (err) {
        if (err.response?.status === 404) return null;
        throw driveError(err, 'lookup');
    }
}

/** Resumable upload session: create (POST) or overwrite an existing file in place (PATCH). */
async function upload(token, bytes, { fileId = null } = {}, env = process.env) {
    const { upload: base } = urls(env);
    const metadata = fileId ? {} : { name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/octet-stream' };
    let session;
    try {
        const start = await http.request({
            method: fileId ? 'PATCH' : 'POST',
            url: fileId ? `${base}/files/${encodeURIComponent(fileId)}` : `${base}/files`,
            params: { uploadType: 'resumable', fields: 'id,size,modifiedTime' },
            headers: { ...bearer(token), 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/octet-stream', 'X-Upload-Content-Length': String(bytes.length) },
            data: JSON.stringify(metadata),
            timeout: 15_000,
        });
        session = start.headers?.location || start.headers?.Location;
        if (!session) throw new Error('no upload session');
    } catch (err) {
        throw driveError(err, 'upload');
    }
    try {
        const res = await http.request({
            method: 'PUT', url: session, data: bytes,
            headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.length) },
            maxBodyLength: Infinity, maxContentLength: Infinity, timeout: 10 * 60_000,
        });
        return { id: res.data?.id || fileId, size: Number(res.data?.size) || bytes.length, modifiedTime: res.data?.modifiedTime || new Date().toISOString() };
    } catch (err) {
        throw driveError(err, 'upload');
    }
}

async function download(token, fileId, env = process.env) {
    try {
        const res = await http.get(`${urls(env).drive}/files/${encodeURIComponent(fileId)}`, {
            headers: bearer(token), params: { alt: 'media' }, responseType: 'arraybuffer', maxContentLength: Infinity, timeout: 10 * 60_000,
        });
        return Buffer.from(res.data);
    } catch (err) {
        throw driveError(err, 'download');
    }
}

async function deleteFile(token, fileId, env = process.env) {
    try {
        await http.delete(`${urls(env).drive}/files/${encodeURIComponent(fileId)}`, { headers: bearer(token), timeout: 15_000 });
        return true;
    } catch (err) {
        if (err.response?.status === 404) return false;
        throw driveError(err, 'delete');
    }
}

module.exports = {
    SCOPES, FILE_NAME, oauthConfig, authUrl, exchangeCode, accessToken, revoke, emailFromIdToken,
    findBackupFiles, getFileMeta, upload, download, deleteFile, _setHttpForTests,
};
