# Oruinwan for Mac, Windows and Linux

The Oruinwan app from [`../mobile`](../mobile/README.md), the same build that ships as the Android
APK, in an Electron window (Electron 44, electron-builder 26). On a laptop or desktop it uses the wide
layout: a sidebar, with your list and the open conversation, task or note side by side. Narrow the
window below 1024 px and it switches to the phone layout.

Like the Android app it signs in to any self-hosted Oruinwan server, or runs the built-in demo. Nothing
is loaded from a hosted web client.

## Develop

```bash
cd mobile && npm install && npm run dev     # the app on http://localhost:5174
cd desktop && npm install && npm start      # Electron, loading that dev server (DevTools open)
```

`npm run start:bundled` builds the app and runs it the way the packaged app does, from `app://oruinwan`.
Set `ORUINWAN_DEV_URL` to point `npm start` somewhere other than port 5174.

## Build installers

```bash
npm run build:mac      # dist/Oruinwan-Mac-<arch>.dmg (the host's arch; add --arm64 / --x64 via npx electron-builder)
npm run build:win      # dist/Oruinwan-Windows-Setup.exe
npm run build:linux    # dist/Oruinwan-Linux.AppImage and dist/Oruinwan-Linux.deb
```

Each first runs `npm run bundle`: it builds `../mobile` and copies `mobile/dist` into `app/`
(git-ignored). Set `ORUINWAN_SKIP_WEB_BUILD=1` to copy an existing build instead.

Releases are built by CI, not by hand: pushing a `vX.Y.Z` tag runs the **Build apps** workflow, which
publishes the APK and all desktop installers together. See "Releasing a new version" in
[mobile/README.md](../mobile/README.md). The app's version comes from `mobile/package.json`.

The icon (`assets/icon.png`) is rendered from the master logo by `mobile/scripts/make-icons.sh`.

## How it works

| | |
|---|---|
| **Loading** | `electron/main.js` serves `app/` from the privileged `app://oruinwan` scheme (standard and secure, so localStorage, IndexedDB and WebCrypto keys work as on https). HTML responses carry a Content-Security-Policy. |
| **Servers** | Self-hosted servers only allow their own web origins for CORS. Like Android's native HTTP, the main process answers CORS for the app's requests (preflights included) and drops `Cross-Origin-Resource-Policy` so avatars load. No server change is needed. |
| **Bridge** | `electron/preload.js` exposes `window.oruinwanDesktop` = `{ platform, arch, version, setBadgeCount, openExternal }`. The app (`mobile/src/native/index.js`) detects the desktop through it. |
| **Security** | Sandboxed renderer, context isolation, no Node. Only `app://oruinwan` may load in the window; links and `window.open` go to the system browser (http, https and mailto only). Permissions are limited to notifications, clipboard, media and fullscreen, for the app's own origin. |
| **Window** | Size and position are remembered (`window-state.json` in the user data folder). A second launch focuses the open window. The unread count shows on the dock (macOS), the launcher (Linux, where supported) and in the window title. |
| **Updates** | The app reads `latest.json` from the latest GitHub release and offers the installer for that computer (Settings → Updates). Installing over the old version keeps your data. |

## Installing unsigned builds

The installers are not signed with an Apple Developer ID or a Windows code-signing certificate yet.

- **Mac:** the app is ad-hoc signed, so Apple Silicon Macs can run it, but Gatekeeper blocks the first
  launch. Open System Settings → Privacy & Security and click **Open Anyway**, or run
  `xattr -dr com.apple.quarantine /Applications/Oruinwan.app`.
- **Windows:** SmartScreen may warn about an unknown publisher: **More info → Run anyway**.

To sign Mac builds, set `CSC_LINK`/`CSC_KEY_PASSWORD` (Developer ID certificate) and the `APPLE_*`
notarization variables in CI, and change `build.mac.identity` from `"-"` to `null` (auto-discovery)
with `hardenedRuntime: true`.
