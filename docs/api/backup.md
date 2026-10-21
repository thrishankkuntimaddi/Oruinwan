# Google Drive backup API

Optional, per-person backup of your Oruinwan data to **your own Google Drive**, encrypted and
packed into one file that never shows among your Drive files. Settings → Backup on web, desktop,
phone and tablet. Code: `server/src/features/drive-backup/`.

## How it works

- **Hidden folder.** Oruinwan asks Google only for `https://www.googleapis.com/auth/drive.appdata`
  (plus `openid email`, to show which Google account is connected). That scope gives access to a
  per-app hidden folder (`appDataFolder`) and nothing else: Oruinwan can't see your other Drive
  files, and its file doesn't appear in Drive's file list (it's listed under Drive → Settings →
  Manage apps, where you can also delete it).
- **One file.** The backup is always `oruinwan-backup.bin`. Each backup **overwrites that file in
  place** (update by file id, resumable upload). If Drive ever holds more than one (e.g. made by
  hand), the newest is kept and updated and the others are deleted.
- **Encrypted.** The file is
  `"ORWNBK01" | uint32 header length | header JSON | iv(12) | tag(16) | ciphertext`.
  The ciphertext is AES-256-GCM over gzip(JSON) with a fresh random 256-bit backup key per backup.
  The backup key is sealed in the header under an account key derived from the server KEK
  (`HKDF-SHA256(KEK, salt = account id, info = "oruinwan-drive-backup-v1")`). The header (account
  id, date, counts) is the GCM additional data, so it can't be edited. Google never holds
  plaintext; only this Oruinwan server, for this account, can open the file.
  *Why not the UMEK:* for password accounts the UMEK is derived on the device and never reaches the
  server, so a scheduled server-side backup couldn't seal for it. Message bodies inside the backup
  are still end-to-end ciphertext, and the identity private key inside is still wrapped by the UMEK.
- **Google token.** The Google refresh token is stored only sealed under the active KEK
  (AES-256-GCM, `v1:<kekVersion>:<base64>`), in the `DriveBackup` collection (one row per user).
  Disconnecting revokes it at Google.
- **Automatic.** A job (`drive-backup`, every 15 min, one instance per tick) backs up everyone with
  automatic backup on who is due: **daily**, or **an hour after a significant change** (any
  successful write under `/api/v2/tasks`, `/api/v2/notes`, `/api/v2/knowledge`, `/api/v2/meetings`,
  `/api/scheduled-meetings` marks the backup as due; at most one marker write per person per 5 min).
  Each backup takes a per-user claim (`drive-backup:<user>:<UTC hour>`, the notification-claim
  pattern) and a lease (`runningUntil`), so it's at-most-once per hour across instances and never
  overlaps a manual run.
- **Safety holds.** Automatic backups pause (`hold`) when (a) you connect a Google account that
  already holds an Oruinwan backup (`existing-backup`): restore it first, or *Back up now* to replace
  it; or (b) the account suddenly has no notes, tasks or pages of its own while the last backup had
  some (`account-empty`). A manual backup or a restore clears the hold.

## What's in a backup, and what a restore does

A restore **merges**: it re-creates what you **own** that is **missing**, keeps record ids (so
nothing is duplicated, and a second restore changes nothing), never overwrites something that
still exists, never re-adds you to a workspace or conversation you left, and never brings back
other people's content (they restore their own from their backups).

| Section | Backed up | Restored |
|---|---|---|
| Profile & settings | name, email, job title, profile fields, preferences, status | empty fields and missing preference keys only (current values win) |
| Encryption keys | identity public key, UMEK-wrapped identity private key and UMEK envelope (as stored), your wrapped conversation keys | identity keys only into an account that has none; your conversation keys where they're missing, for conversations you're still in, and only if your identity key is the same one |
| Workspaces | the workspaces you belong to (id, name, your role) | never — membership is managed by workspace admins; restore only writes into workspaces you're still an active member of |
| Notes | notes you own, notes shared with you, notes of meetings you were in | notes you own |
| Tasks | tasks you created or are assigned to | tasks you created |
| Knowledge | pages you wrote | those pages |
| Meetings | meetings you organised or were invited to: details, summary, action items, notes link (no transcript segments) | meetings you organised |
| Messages | messages **you sent** in channels and DMs you're in, still end-to-end encrypted (newest 50 000; `DRIVE_BACKUP_MAX_MESSAGES`) | yours, in conversations you're still in |
| Files | metadata of files you uploaded (name, size, type, folder, tags) — **no file contents** | never (without the contents a file can't come back) |

Not included: file contents, other people's messages, call recordings, transcripts, workspace or
company settings, billing.

A backup can only be opened by the same Oruinwan account on the same server (same KEK).

## Configuration

| Env | |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | the web OAuth client already used for Google sign-in |
| `GOOGLE_BACKUP_CLIENT_ID`, `GOOGLE_BACKUP_CLIENT_SECRET` | optional: a separate client just for backup |
| `GOOGLE_BACKUP_REDIRECT_URI` | default `${BACKEND_URL}/api/v2/backup/google/callback` |
| `APP_BACKUP_RETURN_URL` | where the phone app is sent back, default `oruinwan://backup` |
| `DRIVE_BACKUP_MAX_MESSAGES` | default 50000 |

In Google Cloud: enable the **Google Drive API**, add the `drive.appdata` scope to the OAuth
consent screen, and add the redirect URI above to the web client's *Authorized redirect URIs*.
Without a client secret (or without a KEK) every endpoint answers `503 BACKUP_NOT_CONFIGURED` and
the apps show "Backup isn't configured on this server".

## Connecting (all apps use the same server-side flow)

1. App calls `POST /google/connect` with `client: 'web' | 'desktop' | 'app'` and opens the returned
   Google URL — web: same tab; desktop: the system browser; phone/tablet: the in-app browser.
2. Google redirects to `GET /google/callback`; the server swaps the code, checks the
   `drive.appdata` scope was granted, seals the refresh token, and looks for an existing backup.
3. It then sends the person back:
   - web → `<web app>/settings?tab=backup&backup=<result>`
   - desktop → a small "you can close this window" page (the app refreshes the status on focus)
   - app → `oruinwan://backup?result=<result>`

   `result`: `connected` (first backup starts right away), `found` (this Google account already
   has a backup: automatic backup waits), `denied`, `scope_denied`, `expired`, `failed`.

## Endpoints — `/api/v2/backup` (signed in, except the callback)

### `GET /status[?offer=1]`
```json
{ "configured": true, "connected": true, "googleEmail": "ada@gmail.com", "autoBackup": true,
  "status": "idle|running|ok|error|reauth", "lastError": null, "hold": null,
  "lastBackupAt": "2026-10-21T08:00:00.000Z", "lastBackupSize": 48211,
  "lastCounts": { "workspaces": 2, "notes": 14, "tasks": 30, "knowledge": 3, "meetings": 5, "messages": 812, "conversationKeys": 9, "files": 4 },
  "lastAttemptAt": "…", "lastRestoreAt": null, "connectedAt": "…", "fileName": "oruinwan-backup.bin",
  "accountLooksEmpty": false }
```
`accountLooksEmpty` (only with `offer=1`): the account has no notes, tasks or pages of its own —
the apps use it to offer a restore after sign-in. `status: "reauth"`: Google access was revoked;
connect again.

### `POST /google/connect` `{ client?, loginHint? }` → `{ url }`
Rate-limited. The `state` in the URL is single-use and lives 10 minutes.

### `GET /google/callback?state&code|error`
Google's redirect target. See *Connecting*.

### `PATCH /settings` `{ autoBackup: boolean }` → status

### `POST /run` → status
Back up now. `409 BACKUP_NOT_CONNECTED`, `409 BACKUP_RUNNING`, `409 DRIVE_REAUTH`, `502 DRIVE_ERROR`.

### `GET /restore/preview` → plan (writes nothing)
```json
{ "backup": { "createdAt": "…", "size": 48211, "counts": { … } },
  "dryRun": true, "total": 3,
  "sections": { "notes": { "inBackup": 14, "present": 12, "restore": 1, "skipped": 1 }, … } }
```
Sections: `profile, keys, conversationKeys, workspaces, notes, tasks, knowledge, meetings,
messages, files`. `present` = already there, `restore` = will be re-created, `skipped` = not
yours, or its workspace/conversation is no longer yours. `404 BACKUP_NOT_FOUND`,
`403 BACKUP_OWNER` (another account's file), `422 BACKUP_DECRYPT`.

### `POST /restore` `{ confirm: true }` → the same shape with `dryRun: false`
Applies the merge. Without `confirm: true` → `400 CONFIRM_REQUIRED`.

### `POST /disconnect` `{ deleteBackup?: boolean }` → status + `{ deleted }`
Revokes the Google token. With `deleteBackup: true` the file is deleted from Drive first (if that
fails, nothing is disconnected: `502 DRIVE_ERROR`). To **change account**, connect again: the
previous token is revoked and the new account gets its own backup (or, if it already has one,
automatic backup waits for you).
