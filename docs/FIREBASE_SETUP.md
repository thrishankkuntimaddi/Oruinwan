# Firebase setup: push notifications and ringing calls on Android

Without this, the Android app gets no notifications while it is closed, and incoming calls only
ring while the app is open. It takes about 15 minutes and is done once.

You will create three things:

| What | Where it goes | Used for |
|---|---|---|
| `google-services.json` | GitHub secret **`GOOGLE_SERVICES_JSON`** | Built into the Android app, so it can receive pushes |
| A service account key (`….json`) | The server's `server/.env` as **`FIREBASE_SERVICE_ACCOUNT`** | Lets the server send pushes |
| The app's signing fingerprints (SHA-1, SHA-256) | The Firebase Android app | Firebase checks the app is really yours |

---

## Step 1: Open Firebase on your Google Cloud project

1. Go to **https://console.firebase.google.com** and sign in with the Google account that owns
   the Google Cloud project **`chttrix-prod-488612`**.
2. Click **Create a project** (or **Add project**).
3. In the name box, click **"Add Firebase to Google Cloud project"** (the link under the box) and
   choose **`chttrix-prod-488612`**. This keeps everything in the project you already use for
   Google sign-in.
4. Google Analytics: choose **Not now** (not needed) → **Continue** → wait for **Your Firebase
   project is ready** → **Continue**.

## Step 2: Add the Android app

1. On the project's home page, click the **Android** icon (or **⚙ Project settings → General →
   Your apps → Add app → Android**).
2. **Android package name:** `com.oruinwan.app` (exactly this).
3. **App nickname:** `Oruinwan Android` (anything).
4. **Debug signing certificate SHA-1:** leave empty for now (Step 3 adds the fingerprints).
5. Click **Register app**.
6. Click **Download google-services.json**. Keep the file; you need it in Step 4.
7. Click **Next** through the remaining screens (the build changes are already done in this
   repository) → **Continue to console**.

## Step 3: Add the app's signing fingerprints

Firebase push works without them, but add them now so Google services keep working later.

Get them from the APK on the latest GitHub release (you need Android's build tools, which come
with Android Studio, or run this on any computer with a JDK):

```bash
# Download the release APK
curl -L -o Oruinwan-Android.apk https://github.com/thrishankkuntimaddi/Oruinwan/releases/latest/download/Oruinwan-Android.apk

# Print its certificate fingerprints (pick one of the two commands)
~/Library/Android/sdk/build-tools/*/apksigner verify --print-certs Oruinwan-Android.apk
keytool -printcert -jarfile Oruinwan-Android.apk
```

Copy the **SHA-1** and **SHA-256** lines. In Firebase: **⚙ Project settings → General → Your apps
→ Oruinwan Android → Add fingerprint**, paste the SHA-1, **Save**; repeat for the SHA-256.

If you also publish on Google Play: Play re-signs the app. Add Play's fingerprints too, from
**Play Console → your app → Test and release → App integrity → App signing**.

## Step 4: Give the Android build the config (GitHub secret)

1. Open **https://github.com/thrishankkuntimaddi/Oruinwan** → **Settings** (top tab) →
   **Secrets and variables** (left menu) → **Actions**.
2. Click **New repository secret**.
3. **Name:** `GOOGLE_SERVICES_JSON`
4. **Secret:** open `google-services.json` in a text editor, select everything, copy, paste here.
   (Pasting the file's base64 also works.)
5. Click **Add secret**.

The next app build (`.github/workflows/apps.yml`) writes it to `mobile/android/app/google-services.json`
and checks it is for `com.oruinwan.app`. Builds without the secret still work, just without push
(the build log says so).

## Step 5: Let the server send pushes (service account key)

1. In Firebase: **⚙ Project settings → Service accounts**.
2. Under **Firebase Admin SDK**, click **Generate new private key** → **Generate key**. A file like
   `chttrix-prod-488612-firebase-adminsdk-xxxxx.json` downloads. Treat it like a password: never
   commit it, never post it.
3. Copy it to the server and add it to the server's settings. In your Mac's terminal (the same way
   you run the server update):

```bash
# Copy the key to the server (replace the file name with yours)
scp ~/Downloads/chttrix-prod-488612-firebase-adminsdk-*.json ubuntu@13.205.213.40:~/firebase-key.json

# On the server: put it into server/.env as one line, remove the copy, restart the app
ssh ubuntu@13.205.213.40 '
  cd ~/oruniwan &&
  KEY=$(python3 -c "import json;print(json.dumps(json.load(open(\"/home/ubuntu/firebase-key.json\"))))") &&
  grep -v "^FIREBASE_SERVICE_ACCOUNT=" server/.env > server/.env.new &&
  printf "FIREBASE_SERVICE_ACCOUNT=%s\n" "$KEY" >> server/.env.new &&
  mv server/.env.new server/.env && chmod 600 server/.env &&
  rm ~/firebase-key.json &&
  docker compose --profile mongo --profile app up -d app
'
```

4. Check the server sees it: in the phone app, **Settings → Notifications → Push notifications**
   must not say *This server can't send them*. On the server you can also look for push errors:

```bash
ssh ubuntu@13.205.213.40 'docker logs --since 10m oruinwan-app 2>&1 | grep -i "\[Push\]"'
```

   No `[Push] FIREBASE_SERVICE_ACCOUNT is not valid JSON` line means the key was read. If the app
   still says the server can't send them, check that `server/.env` has exactly one
   `FIREBASE_SERVICE_ACCOUNT=` line and that the app restarted.

## Step 6: Build and test

1. Release a new version (or run the **Build apps** workflow): the Android app now includes push.
2. Install it on your phone, sign in, and tap **Turn on notifications** on Home (or **Settings →
   Notifications → Push notifications → Turn on**). Allow notifications when Android asks.
3. Android 14 and later: on the same screen, **Calls → Full-screen calls → Open settings** and
   allow it, so calls ring over the lock screen.
4. Test a message: close the app (swipe it away), send yourself a DM from the web app on another
   account. A notification should arrive within seconds.
5. Test a call: keep the app closed, and from the web app start a call in a DM with that account.
   The phone should ring with **Answer** and **Decline**.

## If something doesn't work

| Symptom | Check |
|---|---|
| No **Turn on notifications** card, Settings says *Not available here* | The app was built without `GOOGLE_SERVICES_JSON`. Check the secret name and rebuild. |
| Settings says *This server can't send them* | `FIREBASE_SERVICE_ACCOUNT` is missing or invalid on the server (Step 5). |
| Notifications arrive but calls don't ring full screen | Android 14+: allow **Full-screen calls** (Step 6.3). Also check the phone isn't in Do Not Disturb. |
| Some phones (Xiaomi, Oppo, Realme, Vivo, OnePlus) stay silent when the app is closed | Their battery savers block background apps. In system settings for Oruinwan, set **Battery → Unrestricted / No restrictions** and allow **Auto-start**. |
