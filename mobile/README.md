# Oruinwan for Android

A phone-first Oruinwan app: a React UI in a [Capacitor](https://capacitorjs.com) shell that uses the
phone's system WebView, so the APK is about **1.4 MB**. It signs in to any self-hosted Oruinwan
server, or runs a built-in demo workspace with no account.

| | |
|---|---|
| **Screens** | Home, Chats (channels, DMs, threads), Oruinwan AI, Tasks (list and board), Notes, Search, Notifications, Knowledge, Files, Integrations, Workspace, Settings |
| **Encryption** | Same end-to-end scheme as the web client: RSA-2048 identity keys, AES-256-GCM messages. Keys are created on first sign-in or unlocked with the password, then kept on the phone as non-extractable keys. |
| **Updates** | The app checks for new releases, downloads the APK, verifies its checksum and signing key, then hands it to Android's installer. Data is kept. |
| **Feature flags** | Firebase Remote Config can switch features on or off, or roll them out to a percentage of installs, without a new build. |
| **Themes** | Light, dark and system, in the web client's "Monolith Gloss" palette. |

Not yet: push notifications, sending files or photos, voice and video huddles, iPhone.

## Develop

```bash
cd mobile
npm install
npm run dev            # browser preview at http://localhost:5174 (demo works fully)
npm run lint
npm test               # Vitest
npm run android:debug  # debug APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Requirements: Node 20+, JDK 21 and the Android SDK (platform 36) for APK builds.

Signing in to a real server from the **browser preview** needs that server to allow the preview's
origin (`CORS_EXTRA_ORIGINS`). The Android app needs no CORS entry, because its requests go
through native HTTP.

To try the app against a throwaway server, run `node ../e2e/scripts/start-stack.js` (it seeds
`alice@e2e.oruinwan.test` / `E2e-Passw0rd!` into `_e2e` databases) and sign in from the emulator with
the server address `http://10.0.2.2:8095`.

## Configuration

Copy `.env.example` to `.env`. Every value is public client configuration, never a secret.

| Variable | Purpose |
|---|---|
| `VITE_DEFAULT_SERVER_URL` | Pre-fills the server address on the sign-in screen. |
| `VITE_UPDATE_MANIFEST_URL` | Where to look for a newer build. Default: `latest.json` on this repository's latest GitHub release. |
| `VITE_FIREBASE_*` | Firebase web config for Remote Config and optional anonymous analytics. Leave empty to build without Firebase. |

## Layout

```
src/app/         shell: tab bar, per-tab navigation stacks, theme, routes
src/ui/          shared components (Button, Row, Sheet, Dialog, Markdown, …)
src/features/    screens: home, chats, ai, tasks, notes, settings, more, auth, update
src/data/        session, query cache, demo adapter, live adapter (server, crypto, realtime)
src/native/      Capacitor bridge: system bars, back button, storage, keyboard
src/update/      update manifest checks and the installer bridge
src/config/      build config, feature flags, Firebase Remote Config
android/         the Capacitor Android project (AppUpdaterPlugin, AppWindowPlugin)
scripts/         icons, local release build, update manifest
release-notes/   one Markdown file per version, shown in the app and on the release page
```

Screens never call the server directly: they use `api()` from `src/data/session.js`, which is
either the demo adapter or the live adapter. Both return the same shapes.

## Releasing a new version

Every release must be signed with the same permanent key, or phones will refuse to update.

1. Bump `version` in `package.json` (for example `1.0.0` → `1.1.0`). The Android `versionName` and
   `versionCode` (`major*10000 + minor*100 + patch`) come from it.
2. Write `release-notes/<version>.md`: a few short bullet points.
3. Commit, then tag and push:
   ```bash
   git tag mobile-v1.1.0 && git push origin main mobile-v1.1.0
   ```
4. The **Mobile** workflow builds the signed APK, checks that it is signed with the release key, and
   publishes `Oruinwan-Android.apk` and `latest.json` as a GitHub Release.
5. Installed apps see the update the next time they open (or from Settings → Updates).

To block old versions (for example after a breaking server change), set `minVersion` in the
manifest or in Remote Config; older apps then show an "Update required" screen.

### One-time setup for CI releases

Add these **repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | base64 of the release keystore (`keystore.base64.txt`) |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
| `ANDROID_KEY_ALIAS` | `oruinwan` |
| `ANDROID_KEY_PASSWORD` | the same password as the keystore |
| `MOBILE_ENV` (optional) | the contents of `mobile/.env` (Firebase web config) |

Copy each value from the file rather than retyping it, for example
`xclip -sel clip < ~/.local/oruinwan-signing/keystore.base64.txt`. If the signing secrets are missing,
the release job stops with an explanation instead of publishing a debug-signed APK.

### Building a release on your own machine

```bash
./scripts/release-local.sh
```

It reads the key from `~/.local/oruinwan-signing/` (override with `ORUINWAN_SIGNING_DIR`), builds
`release/Oruinwan-Android-<version>.apk` and `release/latest.json`, and prints the signer.

**Back up `~/.local/oruinwan-signing/`.** If the key is lost, existing installs can't be updated and
everyone has to uninstall and reinstall.

## Remote Config

Firebase project: `oruinwan-127d5`. All keys are optional; the app has defaults. Import
`remote-config.template.json` (Remote Config → ⋮ → Publish from a file) to start.

| Key | Type | Effect |
|---|---|---|
| `features` | JSON | Feature flags, e.g. `{"huddles": false, "ai": true}`. Use conditions for percentage rollouts. |
| `android_release` | String (JSON text) | Same shape as `latest.json`. Lets you announce a release (or set `minVersion`) without GitHub. |
| `default_server_url` | String | Pre-fills the server address for new installs. |
| `announcement` | String | A one-line banner on Home. Empty hides it. |

Settings → Updates in the app lists which features are on and where the values came from.

## Icons

`npm run icons` renders the launcher icons and launch logo from
`../client/public/icons/Oruinwan.png` (needs ImageMagick 7).
