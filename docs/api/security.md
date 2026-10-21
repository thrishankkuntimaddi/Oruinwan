# Security & compliance API

Covers SAML 2.0 SSO, workspace message retention, encrypted backups with verified
restore, and device management. All bodies are JSON unless stated. Errors are
`{ message, code? }`.

---

## SSO discovery

`GET /api/auth/sso/discover?email=ada@acme.com` (no auth, rate-limited 30/min per IP, behind the `sso` flag) →
```json
{ "enabled": true, "protocol": "saml", "startUrl": "https://api…/api/auth/sso/saml/<companyId>/login" }
```
or `{ "enabled": true, "protocol": "oidc", "startUrl": "https://api…/api/auth/sso/okta" }`, else `{ "enabled": false }`
(unknown domain, unverified domain, disabled or unconfigured provider — nothing else is revealed).
SAML wins when both are set; OIDC is read from the company's saved SSO settings
(`sso` / `settings.sso` `{ enabled, provider: google|microsoft|okta }`) and needs that provider's
client id on the server.

To start sign-in, navigate (top-level, not XHR) to `startUrl + "?deviceId=<X-Device-Id value>"`.
The device id is optional; with it the sign-in shows up under Devices.

Both SSO flows end with a **full session**, like password/Google sign-in: a refresh-token
cookie (`jwt`) and session row are created, the device row is recorded, and the browser is
redirected to `{WEB_APP}/oauth-success#access=<accessToken>`. The client then keeps the
session alive with the normal `POST /api/auth/refresh`.

---

## SAML 2.0 single sign-on

Behind the `sso` feature flag (`FEATURES_ENABLED=sso`); with the flag off every
path below returns 404. One Identity Provider per company. Oruinwan is the Service
Provider (SP).

| Item | Value |
|---|---|
| SP entity id | `{BACKEND_URL}/api/auth/sso/saml/{companyId}/metadata` |
| ACS (HTTP-POST) | `{BACKEND_URL}/api/auth/sso/saml/{companyId}/acs` |
| NameID format | `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress` |
| Signing | assertions must be signed by the configured IdP certificate |
| Flow | SP-initiated only. Responses must answer a request we issued (`InResponseTo`), so unsolicited/replayed responses are refused. Request ids are kept in Redis when configured (any instance can take the ACS POST), otherwise in memory. |

### Admin configuration (company owner/admin)

`GET /api/auth/sso/saml/config` →
```json
{ "configured": true, "enabled": true, "entryPoint": "https://idp/sso", "issuer": "https://idp/entity",
  "certFingerprint": "AB:CD:…", "jitProvisioning": false, "updatedAt": "…",
  "entityId": "…/metadata", "metadataUrl": "…/metadata", "acsUrl": "…/acs", "loginUrl": "…/login" }
```
Not configured: `{ "configured": false, entityId, metadataUrl, acsUrl, loginUrl }` (so the admin can register the SP at the IdP first).

`PUT /api/auth/sso/saml/config`
```json
{ "entryPoint": "https://idp.example.com/sso", "cert": "-----BEGIN CERTIFICATE-----…", "issuer": "https://idp.example.com/entity",
  "enabled": true, "jitProvisioning": false }
```
- `entryPoint`: IdP SSO URL (HTTP-Redirect binding), https (http allowed outside production).
- `cert`: IdP signing certificate, PEM or base64 body. Never returned; only its SHA-256 fingerprint.
- `issuer`: IdP entity id. Responses from any other issuer are refused.
- `jitProvisioning`: create accounts on first sign-in for emails on the company's **verified** domain.
Returns the same shape as GET. 400 with `code` `invalid_entry_point | invalid_cert | invalid_issuer`. Audited (`security.saml_configured`).

`DELETE /api/auth/sso/saml/config` → `{ message, configured: false, … }`. Audited (`security.saml_removed`).

### Sign-in

- Use `GET /api/auth/sso/discover` (above) to find the start URL.
- `GET /api/auth/sso/saml/{companyId}/login[?deviceId=…]` → 302 to the IdP (the device id travels as RelayState).
- `POST /api/auth/sso/saml/{companyId}/acs` (form `SAMLResponse`, `RelayState`) → full session (refresh cookie + device row) and 302 to `{WEB_APP}/oauth-success#access=<accessToken>`. On failure → 302 to `{WEB_APP}/login?error=sso_saml_<code>` where code is one of `not_configured, failed, invalid_response, wrong_issuer, no_email, no_name_id, wrong_company, no_account, account_disabled`.
- `GET /api/auth/sso/saml/{companyId}/metadata` → SP metadata XML (`application/samlmetadata+xml`).

Account matching (in order): user already linked to this IdP (`users.sso = { provider: "saml:<companyId>", id: <NameID> }`) → user with that email in this company (linked) → user with no company whose email is on the company's verified domain (linked) → JIT create (if enabled, verified domain) → otherwise refused. Users of another company are always refused. Email is read from `email`/`mail`/standard claim attributes, else from the NameID.

---

## Workspace message retention

A workspace-wide policy set by workspace owners/admins, in addition to each user's
personal policy (`/api/compliance/retention-policy`). Enforced by the daily retention
job: chat messages in the workspace older than the cutoff are tombstoned (content
wiped, `isDeletedUniversally: true`, `deletedByName: "Retention policy"`) exactly as
"delete for everyone" does. **Legal hold always wins:** messages sent by a user on
legal hold, and messages in a DM with a user on legal hold, are never touched.
System messages are skipped. Each run that removes anything writes an audit entry
(`compliance.workspace_retention_enforced`, with counts only).

`GET /api/compliance/workspaces/:workspaceId/retention-policy` (any member) →
```json
{ "workspaceId": "…", "retentionDays": 90, "setBy": "<userId>", "setAt": "…", "legalHoldRespected": true }
```
`retentionDays: null` = keep forever.

`PATCH /api/compliance/workspaces/:workspaceId/retention-policy` (owner/admin) `{ "retentionDays": 1..3650 | null }` → same shape. 400 on invalid value, 403 for non-admins. Audited (`compliance.workspace_retention_updated`, with previous and new value).

---

## Encrypted backups

AES-256-GCM with the server KEK (`SERVER_KEK`, 32-byte hex; without it the endpoints
answer 503 `backup_unavailable`). Company admins back up/restore their own company;
platform staff may pick a company.

**Contents (format `oruinwan-backup-v2`):** identity tables (companies, users without
secrets, workspaces, members, departments, teams), audit logs, and workspace metadata:
`channels, tasks, notes, knowledgePages, knowledgeCategories, files` (file metadata,
not the bytes). Each collection carries a SHA-256 checksum. **Chat messages are never
included** — they are end-to-end encrypted and the server never decrypts them.

`POST /api/security/backup` `{ companyId? }` → 201
```json
{ "message": "…", "meta": { "createdAt", "createdBy", "companyId", "format": "oruinwan-backup-v2",
  "algorithm": "AES-256-GCM", "checksum": "<sha256 of encryptedPayload>",
  "recordCount": { "users", "workspaces", "departments", "teams", "auditLogs", "channels", "tasks", "notes", "knowledgePages", "knowledgeCategories", "files" } },
  "encryptedPayload": "<base64>" }
```
Clients should save `encryptedPayload` together with `meta.checksum`.

`POST /api/security/backup/verify` `{ encryptedPayload, checksum? }` → `{ valid: true, format, backedUpAt, companyId, recordCount }`; failures → 400/403 `{ valid: false, message, code }` with code `invalid_backup | checksum_mismatch | unsupported_format | wrong_company`.

`POST /api/security/backup/restore`
```json
{ "encryptedPayload": "…", "checksum": "…", "collections": ["channels", "tasks"], "dryRun": true }
```
- Dry run is the default. A real restore needs `"dryRun": false, "confirm": "RESTORE"` (else 400 `confirmation_required`).
- Verification first: GCM tag, format, per-collection checksums, company ownership.
- Only documents that **no longer exist** are re-created; live data is never overwritten. Documents whose workspace no longer exists, or now belongs to another company, are skipped.
- Identity tables, audit logs and messages are never restored.
- Audited (`security.backup_restore_dry_run` / `security.backup_restored`).

Response:
```json
{ "dryRun": true,
  "backup": { "format": "oruinwan-backup-v2", "backedUpAt": "…", "companyId": "…", "workspaces": 3 },
  "notRestored": ["identity tables (…)", "audit logs", "messages (never backed up: end-to-end encrypted)"],
  "collections": { "channels": { "inBackup": 12, "existing": 10, "toRestore": 2, "restored": 0,
                                  "skipped": { "workspaceMissing": 0, "foreignWorkspace": 0 } } } }
```

---

## Devices

A device is a device session (one per user + `X-Device-Id` header). Every sign-in that
sends `X-Device-Id` — password login, Google, account
reactivation, SSO (via `?deviceId=`), and token refresh — creates or updates the row
(name/platform from the User-Agent and `X-Client-Platform`). A fresh sign-in on a revoked
device makes it active again; `POST /api/auth/refresh` from a revoked device is refused with
`403 { code: "DEVICE_REVOKED" }`. It is linked to
the sign-in sessions (refresh tokens) that signed in with the same User-Agent, and to
push tokens registered from it. Send `X-Device-Id` on `POST /api/push/register` (or
`deviceId` in the body) so the push token is tied to the device.

`GET /api/v2/devices[?includeRevoked=true]` →
```json
{ "totalCount": 2, "devices": [ {
  "deviceId": "…", "deviceName": "Work phone", "reportedName": "iPhone", "customName": "Work phone",
  "platform": "ios|android|web|unknown", "ipAddress": "…", "trustLevel": "trusted",
  "createdAt": "…", "lastActiveAt": "…", "revoked": false, "revokedAt": null,
  "isCurrent": false, "sessionCount": 1,
  "sessions": [ { "startedAt": "…", "expiresAt": "…", "ip": "…", "current": false } ],
  "pushTokenCount": 1 } ] }
```

`PATCH /api/v2/devices/:deviceId` `{ "name": "Work phone" }` (max 64 chars; `null`/`""` resets to the reported name) → `{ device }`. 404 unknown device.

`DELETE /api/v2/devices/:deviceId` (also `POST /api/v2/devices/revoke { deviceId }` for older clients) — revokes the device session (requests with that device id are refused), deletes its refresh tokens (the caller's own session is kept unless they revoke their own device, in which case the refresh cookie is cleared) and removes its push tokens. Revoking an already revoked device still cleans leftovers. →
```json
{ "message": "Device revoked successfully", "revokedDeviceId": "…", "isCurrentDevice": false,
  "tokensRevoked": 1, "sessionsRevoked": 1, "pushTokensRemoved": 1, "device": { … } }
```

`POST /api/v2/devices/revoke-others` (needs `X-Device-Id`) → `{ message, revokedCount, devicesRevoked, sessionsRevoked, pushTokensRemoved }`.

Device revocations are written to the security audit (`DEVICE_REVOKED`, `ALL_DEVICES_REVOKED`).
