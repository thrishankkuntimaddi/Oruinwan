# Updates

How Oruinwan's apps find out about new versions and install them.

| Where | How it learns | What "update" does |
|---|---|---|
| Desktop app (Mac, Windows, Linux) | `latest.json` from the newest GitHub release, at start and every 6 hours | **Quick update:** downloads the signed UI bundle, checks it, restarts into it. **Full update** (the app itself changed): opens the installer for this computer. |
| Android app (GitHub APK) | Same, plus Firebase Remote Config `android_release` if configured | **Quick update** as above. **Full update:** downloads the APK, checks its SHA-256 and signing certificate, hands it to Android's installer. |
| Android app (Google Play) | Same | **Quick update** in the app; full updates come from Google Play. |
| iPhone / iPad | — | App Store / TestFlight. |
| Web app | `/version.json` from the server, every 30 minutes and when the tab comes back | "A new version is available — **Reload**". |

When something new is found the app shows a toast once per version ("Oruinwan 2.x is available"),
a card at the top of **Notifications** (phone: on Home), and the details in **Settings → About & updates** (web and
desktop) or **Settings → Updates** (phone): current versions (app and interface), *Check for
updates*, release notes and the one-click button.

## Quick updates (UI bundles, no reinstall)

Most releases only change the interface (JavaScript, CSS, images). Each release publishes that
interface as a zip:

- `Oruinwan-UI-phone.zip` — `mobile/dist`, the phone/tablet UI.
- `Oruinwan-UI-desktop.zip` — `client/dist-app`, the web client built for the desktop app.

`latest.json` lists them under `bundles`:

```json
"bundles": {
  "phone":   { "url": "https://github.com/…/Oruinwan-UI-phone.zip", "sha256": "…", "size": 1234567,
               "signature": "<base64 Ed25519>", "minNativeVersion": "2.0.1" },
  "desktop": { "url": "…/Oruinwan-UI-desktop.zip", "sha256": "…", "size": 2345678,
               "signature": "…", "minNativeVersion": "2.0.1" }
}
```

The signature is Ed25519 over the UTF-8 text

```
oruinwan-ui-bundle
<phone|desktop>
<version>
<sha256 hex>
```

so a bundle can't be passed off as the other app's or as another version.

### What the apps check

- **Desktop** (`desktop/electron/ota.js`): the main process downloads the zip (https only, at most
  150 MB), checks the SHA-256 and the signature with the public key shipped in the app, unpacks it
  into `<userData>/ui-bundles/<version>-<random>/` (refusing absolute paths, `..`, zip64,
  encryption, more than 400 MB unpacked), then "Update and restart" relaunches the app, which serves
  `app://oruinwan` from that folder.
- **Android** (`mobile/src/update/updater.js`, `OtaBundlePlugin.java`): the page verifies the
  signature (WebCrypto Ed25519, or a built-in verifier on older WebViews) over the manifest's
  SHA-256; the plugin downloads the zip, refuses it unless its SHA-256 matches, unpacks it into
  app storage and points Capacitor at it (`setServerBasePath`, persisted), then the page reloads
  into it. Same origin, so sign-in, keys and local data stay.
- **Unsigned bundles are refused.** If the release has no signature, or this build has no public
  key, the app offers the full download instead.

### Boot watchdog and rollback

A newly applied bundle is *pending* until the new interface reports that it started (the phone
app after its boot, the desktop client right after it mounts). Otherwise:

- In the same session: no confirmation within 45 seconds, a failed page load, or a crashed
  renderer (desktop) → back to the last good interface immediately.
- Across restarts: a pending bundle gets two starts; on the third it is rolled back before the
  page loads.
- A rolled-back version is never applied again on that device.
- Installing a new full version of the app forgets downloaded bundles (the installer carries
  a newer interface).
- Settings offers "Use the version that came with the app" while a quick update is running.

### When a full install is still needed

Anything outside the interface — a new Capacitor plugin or native method, a new Electron version,
preload or main-process changes — needs the installer. Record it in
[`platform/native-shells.json`](../platform/native-shells.json): set `phone` and/or `desktop` to
the release version that introduces the native change. That becomes the bundle's
`minNativeVersion`; apps older than it get "This version changes the app itself, so it needs the
full download" and the existing installer path. `minVersion` (the release workflow's `--min`)
still forces an update for everyone below it.

## Signing key setup

1. Create the key pair once (keep the private key safe; losing it means every installed app needs
   a full install to trust a new key):

   ```bash
   node scripts/update-signing.mjs keygen      # writes ~/.local/oruinwan-signing/ota-ed25519-private.pem
   ```

2. Put the printed public key in [`platform/update-public-key.txt`](../platform/update-public-key.txt)
   and commit it. Builds compile it in: the phone UI via `mobile/vite.config.js`, the desktop app
   via `desktop/scripts/bundle-app.mjs` (copied to `desktop/electron/update-public-key.txt`).
   `ORUINWAN_UPDATE_PUBLIC_KEY` overrides it at build time (forks).
3. Add the whole PEM file as the GitHub Actions secret **`ORUINWAN_UPDATE_SIGNING_KEY`**
   (Settings → Secrets and variables → Actions). A base64 32-byte seed also works.
4. Tag a release. The `publish` job in `.github/workflows/apps.yml` signs both zips
   (`mobile/scripts/write-manifest.mjs --bundle …`), refuses to publish if the key doesn't match
   the committed public key, and uploads the zips with `latest.json`. Without the secret it warns
   and publishes the zips unsigned, and apps keep using the full download.

Check a key: `ORUINWAN_UPDATE_SIGNING_KEY="$(cat key.pem)" node scripts/update-signing.mjs public`.

## Web app

Every web build writes `version.json` (`{ "version", "build" }`) next to `index.html`
(`client/vite.config.js`) and bakes the same build id into the code. The page polls
`/version.json` and offers *Reload* when the server has a different build. The service worker
never caches that file. Set `ORUINWAN_BUILD_ID` at build time to use your own id (e.g. the commit).

## Code map

- `mobile/src/update/bundle.js` — manifest bundles, signed message, `planUpdate`, update state machine (copied to `client/src/appMode/updates/`; a test keeps them identical).
- `mobile/src/update/ed25519.js` — signature verification for the phone app.
- `mobile/src/update/updater.js`, `mobile/src/features/update/*` — phone checks and UI.
- `mobile/android/app/src/main/java/com/oruinwan/app/OtaBundle{Plugin,Store}.java` — download, unpack, apply, watchdog.
- `client/src/appMode/updates/store.js`, `UpdateNotice.jsx`, `UpdateCard.jsx`, `pages/settingsTabs/UpdatesTab.jsx` — web and desktop.
- `desktop/electron/ota.js`, `unzip.js`, `main.js` (IPC `oruinwan:update:*`), `preload.js` (`window.oruinwanDesktop.updates`).
- `mobile/scripts/write-manifest.mjs`, `scripts/update-signing.mjs`, `.github/workflows/apps.yml` — release side.
