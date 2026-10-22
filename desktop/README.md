# Oruinwan for Mac, Windows and Linux

The full Oruinwan web client ([`../client`](../client), built with `vite build --mode app`) in an
Electron window (Electron 44, electron-builder 26): the same workspace as in the browser, with native
notifications and an unread badge. It talks to the Oruinwan server fixed at build time
(`VITE_SERVER_URL`, see `client/src/appMode/env.js`), then the usual sign-in.

The same app build runs on Android tablets and iPads ([`../mobile`](../mobile/README.md)).

## Develop

```bash
yarn install                                          # repo root: the web client's dependencies
cd client && npx vite --mode app                      # the web client in app mode on http://localhost:3000
cd desktop && npm install && npm start                # Electron, loading that dev server (DevTools open)
```

`npm run start:bundled` builds the app and runs it the way the packaged app does, from `app://oruinwan`.
Set `ORUINWAN_DEV_URL` to point `npm start` somewhere other than port 3000. To try it against a
throwaway server, run `node e2e/scripts/start-stack.js` and connect to `localhost:8095`
(`alice@e2e.oruinwan.test` / `E2e-Passw0rd!`).

### Test the real app

`test-e2e/` drives the desktop app itself (Electron main, preload and the bundled web app) with
Playwright against a throwaway stack on ports 8103/3103: sign-in, every main page, microphone and
notifications, a call between two copies of the app (connect, audio flowing, screen share, the
floating call window), in-app links, and incoming-call attention.

```bash
cd desktop
VITE_SERVER_URL=http://localhost:8103 node scripts/bundle-app.mjs   # the app, pointed at the test stack
npm run test:e2e                                                    # needs MongoDB and PostgreSQL running
```

Set `E2E_DATABASE_URL` if PostgreSQL isn't on port 5432. The test runs the app with
`ORUINWAN_TEST_MODE=1` (a fake camera and microphone, no system prompts, screen sharing counted and
cancelled) and `ORUINWAN_USER_DATA` (its own profile); both are ignored by installed builds.

## Build installers

```bash
npm run build:mac      # dist/Oruinwan-Mac-<arch>.dmg (the host's arch; add --arm64 / --x64 via npx electron-builder)
npm run build:win      # dist/Oruinwan-Windows-Setup.exe
npm run build:linux    # dist/Oruinwan-Linux.AppImage and dist/Oruinwan-Linux.deb
```

Each first runs `npm run bundle`: it builds `../client` in app mode and copies `client/dist-app` into
`app/` (git-ignored). Set `ORUINWAN_SKIP_WEB_BUILD=1` to copy an existing build instead.

Releases are built by CI, not by hand: pushing a `vX.Y.Z` tag runs the **Build apps** workflow, which
publishes the APK and all desktop installers together. See "Releasing a new version" in
[mobile/README.md](../mobile/README.md). The app's version comes from `mobile/package.json`.

The icon (`assets/icon.png`) is rendered from the master logo by `mobile/scripts/make-icons.sh`; the tray
icons in `assets/tray/` from it by `npm run tray-icons`. Unit tests for the tray, close and quick-reply
logic (`electron/trayState.js`): `npm test`.

## How it works

| | |
|---|---|
| **Loading** | `electron/main.js` serves `app/` from the privileged `app://oruinwan` scheme (standard and secure, so localStorage, IndexedDB and WebCrypto keys work as on https). In-app routes (`/login`, `/workspace/…`) get `index.html`. HTML responses carry a Content-Security-Policy. |
| **Servers** | Self-hosted servers only allow their own web origins for CORS, so the main process answers CORS for the app's requests (preflights included) and drops `Cross-Origin-Resource-Policy` so avatars load. Sign-in uses the server's app token mode (`x-client-platform: desktop`, refresh token in the response body) instead of the browser's cross-site cookie. |
| **Bridge** | `electron/preload.js` exposes `window.electronAPI` (what `client/src/desktop/bridge.js` uses for notifications, the badge and notification clicks) and `window.oruinwanDesktop` (`{ platform, arch, version, setBadgeCount, openExternal }`, which marks the desktop app). |
| **Security** | Sandboxed renderer, context isolation, no Node. Only `app://oruinwan` may load in the window. Links and `window.open` to the app's own pages ("Open meeting page", task links) navigate inside the window without a reload (a running call keeps going); everything else goes to the system browser (http, https and mailto only). Permissions are limited to notifications, clipboard, media, screen capture and fullscreen, for the app's own origin. |
| **Microphone, camera, screen** | On top of Chromium's permission, macOS and Windows have their own privacy switches (`electron/permissions.js`). The first call asks macOS (`systemPreferences.askForMediaAccess`) before the page gets the microphone or camera, so the first call works instead of failing while the system prompt is still open. If access was turned off, the app explains where to turn it on and offers **Open System Settings** (Windows: **Open Settings**). Screen sharing uses the macOS 15+ system picker (no screen-recording permission needed); older macOS needs Screen Recording access, and the app explains it when it's missing. The Mac build carries the usage texts (`build.mac.extendInfo`) and the camera/microphone entitlements (`assets/entitlements.mac.plist`, used once the app is signed with hardened runtime). |
| **Calls** | The call screen and ringtone are the web app's. The app adds: a small always-on-top call window when the app is minimised or behind other apps during a call, and for an incoming call (`oruinwan:ring` from the page) it shows the window again if it was in the tray (without taking focus), bounces the dock / flashes the taskbar, and shows a notification. On macOS it has **Accept** and **Decline**; elsewhere a click opens the app. The answer reaches the page as `oruinwan:ring-action`. |
| **Window** | Size and position are remembered (`window-state.json` in the user data folder). A second launch focuses the open window. The unread count shows on the dock (macOS), the launcher (Linux, where supported), the tray and in the window title. |
| **Tray** | A tray / menu bar icon (`assets/tray/`, made by `npm run tray-icons`) gets a dot and the tooltip "Oruinwan — N unread" when there is unread activity. Clicking it opens the window (macOS: right-click for the menu). Its menu: **Open Oruinwan**, **Do Not Disturb** (no native notifications while on; remembered in `desktop-settings.json`), **Launch at Login** (macOS and Windows only; Linux desktops use their own autostart settings, so the item is hidden there) and **Quit Oruinwan**. |
| **Closing** | Closing the window hides it instead of quitting (macOS: the app stays in the dock and a dock click brings it back; Windows/Linux: it stays in the tray). Only Quit (tray, app menu, Cmd+Q) or logging out ends the app. The page keeps running while hidden, with background throttling off, so the socket keeps syncing messages, notifications and the unread count. If a Linux desktop has no tray, closing quits as before. |
| **Quick reply** | macOS and Windows notifications for a channel or DM have an inline **Reply** field. The main process validates the conversation ids and caps the text at 4000 characters, then hands it to the page (`oruinwan:quick-reply`), which encrypts it with the conversation key and sends it like the composer does (`client/src/desktop/quickReply.js`); plaintext never goes to the server. If it can't be sent (keys still locked, offline), the conversation opens instead. On Linux, clicking a notification opens the conversation. |
| **Updates** | The app reads `latest.json` from the latest GitHub release and offers the installer for that computer. Installing over the old version keeps your data. |

## Installing unsigned builds

The installers are not signed with an Apple Developer ID or a Windows code-signing certificate yet.

- **Mac:** the app is ad-hoc signed, so Apple Silicon Macs can run it, but Gatekeeper blocks the first
  launch. Open System Settings → Privacy & Security and click **Open Anyway**, or run
  `xattr -dr com.apple.quarantine /Applications/Oruinwan.app`.
- **Windows:** SmartScreen may warn about an unknown publisher: **More info → Run anyway**.

To sign Mac builds, set `CSC_LINK`/`CSC_KEY_PASSWORD` (Developer ID certificate) and the `APPLE_*`
notarization variables in CI, and change `build.mac.identity` from `"-"` to `null` (auto-discovery)
with `hardenedRuntime: true`.
