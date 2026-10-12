# The Oruinwan app: Android, desktop and web

One React app, shipped three ways from this directory:

| Platform | How | Where |
|---|---|---|
| **Android** | a [Capacitor](https://capacitorjs.com) shell on the phone's system WebView, so the APK is about **1.4 MB** | `android/` |
| **Mac, Windows, Linux** | an Electron shell around this same build | [`../desktop/`](../desktop/README.md) |
| **Web** | the same build on GitHub Pages | `.github/workflows/web.yml` |

It signs in to any self-hosted Oruinwan server, or runs a built-in demo workspace with no account.
Phones get a phone layout with a bottom tab bar. Windows 1024 px and wider (laptops, desktops,
tablets in landscape) get a sidebar, with the list and the open conversation, task or note side by
side (`src/app/layout.js`).

| | |
|---|---|
| **Screens** | Home, Chats (channels, DMs, threads), Oruinwan AI, Tasks (list and board), Notes, Search, Notifications, Knowledge, Files, Integrations, Workspace, Settings |
| **Encryption** | Same end-to-end scheme as the web client: RSA-2048 identity keys, AES-256-GCM messages. Keys are created on first sign-in or unlocked with the password, then kept on the phone as non-extractable keys. |
| **Updates** | Android: the app checks for new releases, downloads the APK, verifies its checksum and signing key, then hands it to Android's installer. Desktop: it offers the installer for that computer. Web: always the latest deploy. Data is kept. |
| **Feature flags** | Firebase Remote Config can switch features on or off, or roll them out to a percentage of installs, without a new build. |
| **Themes** | Light, dark and system, in the web client's "Monolith Gloss" palette. |

Not yet: push and desktop notifications, sending files or photos, voice and video huddles, iPhone.

Requires Android 7 or newer with an up-to-date **Android System WebView** (Chromium 111+, updated through
the Play Store). Older WebViews get a page explaining how to update (`public/webview-update.html`).

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

Signing in to a real server from a **browser** (the dev preview or the web app on GitHub Pages)
needs that server to allow the page's origin in `CORS_EXTRA_ORIGINS`, for example
`https://thrishankkuntimaddi.github.io`. The Android and desktop apps need no CORS entry: Android's
requests go through native HTTP, and the desktop app answers CORS in its main process.

Widen the browser past 1024 px to see the laptop layout. To run it in the desktop shell, start
`npm run dev` here and `npm start` in `../desktop`.

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
src/app/         shell: tab bar or sidebar (layout.js), per-tab navigation stacks, theme, routes
src/ui/          shared components (Button, Row, Sheet, Dialog, Markdown, …)
src/features/    screens: home, chats, ai, tasks, notes, settings, more, auth, update
src/data/        session, query cache, demo adapter, live adapter (server, crypto, realtime)
src/native/      platform bridge (Capacitor on Android, window.oruinwanDesktop on desktop): system bars, back button, storage, keyboard
src/update/      update manifest checks and the installer bridge
src/config/      build config, feature flags, Firebase Remote Config
android/         the Capacitor Android project (AppUpdaterPlugin, AppWindowPlugin)
scripts/         icons, local release build, update manifest
release-notes/   one Markdown file per version, shown in the app and on the release page
```

Screens never call the server directly: they use `api()` from `src/data/session.js`, which is
either the demo adapter or the live adapter. Both return the same shapes.

## Releasing a new version

One version number covers every platform. Every Android release must be signed with the same
permanent key, or phones will refuse to update.

1. Bump `version` in `package.json` (for example `1.1.0` → `1.2.0`). The Android `versionName` and
   `versionCode` (`major*10000 + minor*100 + patch`) and the desktop app's version come from it.
   (Keep `../desktop/package.json` in step; CI overrides it with this one anyway.)
2. Write `release-notes/<version>.md`: a few short bullet points.
3. Commit, then tag and push:
   ```bash
   git tag v1.2.0 && git push origin main v1.2.0
   ```
4. The **Build apps** workflow (`.github/workflows/apps.yml`) lints and tests, builds the signed APK
   (and checks it is signed with the release key) and the desktop apps for Mac (Apple Silicon and
   Intel), Windows and Linux, then publishes them in **one** GitHub Release with `latest.json`:

   | File | For |
   |---|---|
   | `Oruinwan-Android.apk` | Android 7+ |
   | `Oruinwan-Mac-AppleSilicon.dmg`, `Oruinwan-Mac-Intel.dmg` | macOS |
   | `Oruinwan-Windows-Setup.exe` | Windows 10 and 11 |
   | `Oruinwan-Linux.AppImage`, `Oruinwan-Linux.deb` | Linux |

   The names never change, so `https://github.com/thrishankkuntimaddi/Oruniwan/releases/latest/download/<file>`
   always points at the newest build.
5. Installed apps see the update the next time they open (or from Settings → Updates).

Pushes to `main` run the same builds without publishing; each run keeps the APK and the desktop
installers as downloadable artifacts for two weeks. Tags before 1.1.0 were named `mobile-v*`.

The **Deploy web app** workflow (`.github/workflows/web.yml`) publishes this app to GitHub Pages
on every push to `main` that touches `mobile/`. One-time setup: Settings → Pages → Build and
deployment → Source: **GitHub Actions**.

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
`release/Oruinwan-Android.apk` (plus a versioned copy) and `release/latest.json`, and stops if the APK
is not signed with the release key.

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
