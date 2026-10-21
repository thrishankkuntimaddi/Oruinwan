# Sign-in, devices, QR sign-in and message keys

How a device gets signed in, how many devices may be, and how message keys reach a new device.
Code: `server/src/features/auth/{signInFlow,qrSignIn,approvals,signIn.routes}.js`,
`server/src/features/devices/devices.service.js`, `server/src/features/crypto/identity.controller.js`.

All requests send `X-Device-Id` (the install's random device id, `[A-Za-z0-9._:-]{8,128}`).
A request to `/api/auth/*` without one (and without the device cookie) gets an id made on the
server: it comes back in the `X-Device-Id` response header (exposed to CORS; the web and phone apps
keep it when they have none of their own and send it from then on) and in the httpOnly
`oruinwan_did` cookie (browsers send it back by themselves). So a sign-in without the header is
still recorded under Devices and counted for the device limit. Apps also send `x-client-platform: ios|android|desktop` and get the refresh token in JSON; browsers
get it as the httpOnly `jwt` cookie.

## Configuration

| Env | Default | Meaning |
| --- | --- | --- |
| `DEVICE_LIMIT` | `4` | Devices an individual account may have signed in at once (web browsers, desktop app, phone/tablet app; each device id counts once). `0` = no limit. Not plan-based. |
| `COMPANY_DEVICE_LIMIT` | unset (no limit) | Company accounts are not limited unless this is set (`0` = no limit). |

When the device table can't be read (database down) the sign-in is let through, and the server logs
an error `DEVICE LIMIT NOT ENFORCED` for every such sign-in.
| `REFRESH_TOKEN_DAYS` | `7` | A device not seen for this long no longer holds a place. |

A device holds a place while its row in `user_device_sessions` is not signed out (`revoked = false`)
and it was active within `REFRESH_TOKEN_DAYS`. Signing out (`POST /api/auth/logout`) frees the place
of the device that signs out; `POST /api/auth/logout-all` frees all of them. Refreshing a session
(`POST /api/auth/refresh`) only keeps a known device active — it never adds a device.

Approximate location ("near Hyderabad, IN") comes only from CDN/proxy headers when present
(`CloudFront-Viewer-City/Country`, `CF-IPCity/CF-IPCountry`, `X-Vercel-IP-City/Country`); no IP
lookups are made. Without them the IP address is shown.

## Every sign-in: second factor, then the device limit

Every way of signing in — password (`POST /login`), Google on web / desktop / Android
(`POST /google-login`, `/google-signup`), passkeys (`POST /passkeys/login/verify`), SSO
(OIDC/SAML browser callbacks and `POST /sso/app/exchange`), QR (`POST /qr/poll`) and reactivating a
deactivated account (`POST /reactivate/verify-otp`, which answers like `POST /login`) — goes through
the same gate once the person is known:

1. **Two-step verification** (accounts with 2FA on). Any one of: approve on a signed-in device, the
   authenticator-app code, or a 6-digit code by email. Passkeys (user verification), SSO (the
   identity provider) and QR sign-in (approved on a signed-in device) already are the second factor.
2. **Device limit.** A device that is already signed in may always sign in again; a new device over
   the limit must sign one out first.

When either step stops the sign-in, no session is issued and the answer carries a `pendingToken`:
32 random bytes (base64url, 43 chars), stored only as a SHA-256 hash, valid 10 minutes, bound to the
`X-Device-Id` that started it, redeemed once (atomic take) when the session is issued. It is sent in
JSON bodies only — except the SSO browser hand-off, which redirects to
`/oauth-success#pending=<token>` (a URL fragment never reaches a server).

### `401` — second factor needed

```json
{
  "code": "MFA_REQUIRED", "requires2FA": true,
  "pendingToken": "…", "expiresAt": "…",
  "methods": { "approve": true, "totp": true, "email": true },
  "approvalId": "…", "emailHint": "al••@example.com",
  "message": "Approve this sign-in on a device where you are signed in, or enter a code."
}
```

`methods.approve` is true when another device is signed in; those devices get the request at once
(socket + push, see *Approvals*; at most 10 requests per account per 10 minutes, after that only codes). Older clients may still send `otp` with the password in one step.

### `409` — device limit

```json
{
  "code": "DEVICE_LIMIT", "limit": 4, "pendingToken": "…", "expiresAt": "…",
  "devices": [{ "id": "…", "name": "Chrome on macOS", "platform": "web", "lastActiveAt": "…", "location": "Hyderabad, IN" }],
  "message": "You're signed in on 4 devices. Sign out of one to continue."
}
```

### `POST /api/auth/signin/continue`

```json
{ "pendingToken": "…", "otp": "123456" }                    // authenticator code
{ "pendingToken": "…", "emailCode": "123456" }              // code from the email
{ "pendingToken": "…" }                                     // after approval on another device
{ "pendingToken": "…", "signOutDeviceIds": ["<device id>"] } // device limit: sign one out
{ "pendingToken": "…", "signOutAll": true }                 // "Sign out everywhere and sign in here"
```

Answers: the session (same shape as the original sign-in path: `accessToken`, `user`, and for apps
`refreshToken`; QR adds `keys`), or another `401 MFA_REQUIRED` (`waiting: true` while an approval is
pending, `invalidCode: true` after a wrong code), `409 DEVICE_LIMIT` (second factor done, now the
limit), `403 SIGNIN_DENIED` (denied on another device — the sign-in ends), `403 SIGNIN_OTHER_DEVICE`,
`410 SIGNIN_EXPIRED` (unknown, expired or already used token), `429 SIGNIN_TOO_MANY` (10 wrong codes
end the sign-in). Wrong authenticator codes also count towards the account's 5-strike lockout.

### `POST /api/auth/signin/status` `{ pendingToken }`

For polling while waiting: `{ stage: "mfa"|"device_limit"|"ready", methods, approval: { status:
"pending"|"approved"|"denied"|"expired" } | null, emailHint, devices, expiresAt }`.

### `POST /api/auth/signin/email-code` `{ pendingToken }`

Sends a 6-digit code (10 minutes) to the account's email. At most 3 per sign-in and 6 per account
per hour (`429 EMAIL_CODE_LIMIT`). → `{ sent: true, emailHint, expiresAt }`.

## Approvals (signed-in devices)

Pending requests reach signed-in devices by socket (`auth:approval-request` to room `user:<id>`,
then `auth:approval-resolved`), by push (`data.type: "signin_approval" | "unlock_approval"`,
"Sign-in request from Windows laptop — Approve / Deny") and by listing:

- `GET /api/auth/approvals` → `{ approvals: [{ id, kind: "signin"|"unlock", status, requester: { deviceName, platform, location, ip, method }, createdAt, expiresAt }] }`
- `POST /api/auth/approvals/:id/decision` `{ approve: true|false }` → `{ approval }` (sign-in requests).
  A device can't approve its own request; answered or expired requests answer `409`/`404`.

The approving device is recorded: the new device's row keeps `signIn: { method, at, approvedBy:
{ deviceId, deviceName } }` (shown under Settings → Devices) and the security audit log gets
`SIGNIN_SECOND_FACTOR` / `SIGNIN_APPROVED` / `SIGNIN_DENIED` / `QR_SIGNIN_APPROVED` events.

## QR sign-in

The QR holds only `oruinwan://signin?c=<code>` (24 random bytes). The device that will get the
session also holds a `secret` (never in the QR, stored as a hash) and an ephemeral P-256 key; polling
needs the secret and the same `X-Device-Id`. Codes live 60 s until scanned/claimed (screens show a
fresh one every minute), 3 minutes to decide, 2 minutes to collect; collecting is single-use.
Approval on the signed-in device is the second factor; the device limit still applies (`409
DEVICE_LIMIT` from `/qr/poll`, then `/signin/continue`). Creating codes is rate limited per IP.

### Computer shows the code, phone approves ("Sign in with QR" on the login screen)

1. Computer: `POST /api/auth/qr/request` `{ publicKey }` (raw uncompressed P-256, base64) →
   `{ code, secret, qrText, qrDataUrl, expiresAt }`.
2. Phone (signed in, Settings → Scan to sign in): `POST /api/auth/qr/scan` `{ code }` →
   `{ status: "scanned", requester: { deviceName: "Chrome on macOS", platform, location, ip } }`.
3. Phone: `POST /api/auth/qr/decide` `{ code, approve }`.
4. Computer polls `POST /api/auth/qr/poll` `{ code, secret }` → `{ status: "waiting"|"scanned" }`
   … then the session.

### Computer shows the code, phone signs in ("Sign in a phone" in Settings → Devices)

1. Computer (signed in): `POST /api/auth/qr/offer` → `{ code, qrText, qrDataUrl, expiresAt }`.
2. Phone (start screen → Scan QR code): `POST /api/auth/qr/claim` `{ code, publicKey }` →
   `{ secret, approver: { deviceName, … }, expiresAt }`. The computer hears `auth:qr-claimed`.
3. Computer: `POST /api/auth/qr/offer/status` `{ code }` → `{ status: "claimed", requester }`, then
   `POST /api/auth/qr/decide` `{ code, approve }` ("Allow iPhone to sign in?").
4. Phone polls `POST /api/auth/qr/poll` `{ code, secret }` → the session.

Scanning a code meant for the other direction answers `400 QR_WRONG_SIDE`; others: `410
QR_EXPIRED`, `409 QR_USED` / `QR_NOT_YOURS`, `403 QR_BAD_SECRET` / `QR_OTHER_DEVICE` / `QR_DENIED`,
`429 QR_RATE_LIMIT`.

The session answer of a QR sign-in adds the message key:
`{ …session, keyMode: "SERVER_KEK", keys: { serverEphemeralPublicKey, rewrappedUmek } }` — the UMEK
wrapped for the requester's ephemeral key (ECDH P-256 → PBKDF2-SHA256 `umek-wrap-v1`, 10 000 → AES-256-GCM
`iv|tag|data`, the same as `/api/v2/crypto/identity/unwrap-umek`). Accounts whose key is still
password-protected get `keyMode: "PASSWORD", keys: null` (see below).

## Devices

`/api/v2/devices` (list / rename / sign out / sign out all others) — each device now also has
`location` and `signIn: { method, at, approvedBy }`. Device names: browsers "Chrome on macOS",
the desktop app "Oruinwan desktop on macOS", phones their model.

## Message keys: automatic unlock

Messages are encrypted in transit and at rest. Oruinwan's server keeps a sealed copy of each
account's message key (UMEK, sealed under the server KEK) so every signed-in device unlocks
automatically — no password prompt for messages, including Google sign-in.

- New accounts get a server-sealed key (`umekProtectionType: SERVER_KEK`).
- Older password-protected accounts move over on the next password sign-in or password unlock:
  the device that opened the key sends it once, `POST /api/v2/crypto/identity/seal-umek` `{ umek }`
  (32 bytes, base64). The server checks it opens the stored private key (`400 UMEK_MISMATCH`
  otherwise), seals it, sets `SERVER_KEK`, bumps `version`, logs `UMEK_SEALED_FOR_AUTO_UNLOCK` and
  emits `crypto:umek-sealed`. The identity key pair is unchanged, so every past message still opens.
- `rotate-umek` no longer re-locks a sealed key with a password (older apps did after "set a
  password"): it answers `{ success: true, kept: "SERVER_KEK" }` and changes nothing.
- Until an account has moved over, a fresh device signed in with Google unlocks once: with the
  password, or by asking another device:
  - `POST /api/v2/crypto/unlock-requests` → `{ id, expiresAt }` (approval kind `unlock`, sent to
    signed-in devices; 5 per 10 minutes).
  - The other device enters the password once (it calls `seal-umek`) and
    `POST /api/v2/crypto/unlock-requests/:id/decision` `{ approve: true }` (`409 UMEK_NOT_SEALED`
    before the key is sealed).
  - The asking device polls `GET /api/v2/crypto/unlock-requests/:id` → `{ status, umekProtectionType }`
    and, once `SERVER_KEK`, unwraps the key from the server as usual. After that, never again.
