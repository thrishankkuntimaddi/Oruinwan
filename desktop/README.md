# Oruinwan for Mac, Windows and Linux

The full Oruinwan web client ([`../client`](../client), built with `vite build --mode app`) in an
Electron window (Electron 44, electron-builder 26): the same workspace as in the browser, with native
notifications and an unread badge. The first launch asks for the team's server address
(`client/src/appMode`), then the usual sign-in, or opens a demo workspace that runs entirely on the
device (`client/src/appMode/demo`).

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

The icon (`assets/icon.png`) is rendered from the master logo by `mobile/scripts/make-icons.sh`.

## How it works

| | |
|---|---|
| **Loading** | `electron/main.js` serves `app/` from the privileged `app://oruinwan` scheme (standard and secure, so localStorage, IndexedDB and WebCrypto keys work as on https). In-app routes (`/login`, `/workspace/…`) get `index.html`. HTML responses carry a Content-Security-Policy. |
| **Servers** | Self-hosted servers only allow their own web origins for CORS, so the main process answers CORS for the app's requests (preflights included) and drops `Cross-Origin-Resource-Policy` so avatars load. Sign-in uses the server's app token mode (`x-client-platform: desktop`, refresh token in the response body) instead of the browser's cross-site cookie. |
| **Bridge** | `electron/preload.js` exposes `window.electronAPI` (what `client/src/desktop/bridge.js` uses for notifications, the badge and notification clicks) and `window.oruinwanDesktop` (`{ platform, arch, version, setBadgeCount, openExternal }`, which marks the desktop app). |
| **Security** | Sandboxed renderer, context isolation, no Node. Only `app://oruinwan` may load in the window; links and `window.open` go to the system browser (http, https and mailto only). Permissions are limited to notifications, clipboard, media and fullscreen, for the app's own origin. |
| **Window** | Size and position are remembered (`window-state.json` in the user data folder). A second launch focuses the open window. The unread count shows on the dock (macOS), the launcher (Linux, where supported) and in the window title. |
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
