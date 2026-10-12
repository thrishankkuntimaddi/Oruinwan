#!/usr/bin/env bash
# Builds a signed release APK on this machine with the permanent release key.
# The key lives outside the repo: $ORUINWAN_SIGNING_DIR (default ~/.local/oruinwan-signing)
# holding oruinwan-release.p12 and password.txt. Output goes to mobile/release/ (git-ignored).
set -euo pipefail
cd "$(dirname "$0")/.."

DIR=${ORUINWAN_SIGNING_DIR:-$HOME/.local/oruinwan-signing}
if [[ ! -f "$DIR/oruinwan-release.p12" || ! -f "$DIR/password.txt" ]]; then
  echo "Release key not found in $DIR. Refusing to build an unsigned or debug-signed release." >&2
  exit 1
fi
export ANDROID_KEYSTORE_PATH="$DIR/oruinwan-release.p12"
ANDROID_KEYSTORE_PASSWORD="$(cat "$DIR/password.txt")"
export ANDROID_KEYSTORE_PASSWORD
export ANDROID_KEY_ALIAS=oruinwan
export ANDROID_KEY_PASSWORD="$ANDROID_KEYSTORE_PASSWORD"

VERSION=$(node -p "require('./package.json').version")
npm run build
npx cap sync android
(cd android && ./gradlew --no-daemon -q assembleRelease)

mkdir -p release
# Oruinwan-Android.apk is the name latest.json points at; the versioned copy is for archiving.
APK=release/Oruinwan-Android.apk
cp android/app/build/outputs/apk/release/app-release.apk "$APK"
cp "$APK" "release/Oruinwan-Android-$VERSION.apk"
NOTES=release-notes/$VERSION.md
# --android-only: a local build has no desktop installers, so latest.json must not point at any.
node scripts/write-manifest.mjs "$APK" release/latest.json --android-only ${NOTES:+$( [[ -f $NOTES ]] && echo --notes "$NOTES")}

# Must match the permanent key (also pinned in .github/workflows/apps.yml).
EXPECTED=95e2de0f297d8d22d2280645ebf6c020ea82482e2ad25efdfe889baf5493f7e5
BUILD_TOOLS=$(ls -d "${ANDROID_HOME:-$HOME/Android/Sdk}"/build-tools/* | sort -V | tail -1)
SIGNER=$("$BUILD_TOOLS/apksigner" verify --print-certs "$APK" | grep -m1 'certificate SHA-256 digest' | awk '{print $NF}')
if [[ "$SIGNER" != "$EXPECTED" ]]; then
  echo "The APK is signed with $SIGNER, not the Oruinwan release key. Do not publish it." >&2
  exit 1
fi
echo "Signed with the release key ($SIGNER)"
ls -la release/
