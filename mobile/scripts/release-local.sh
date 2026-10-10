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
APK=release/Oruinwan-Android-$VERSION.apk
cp android/app/build/outputs/apk/release/app-release.apk "$APK"
NOTES=release-notes/$VERSION.md
node scripts/write-manifest.mjs "$APK" release/latest.json ${NOTES:+$( [[ -f $NOTES ]] && echo --notes "$NOTES")}

BUILD_TOOLS=$(ls -d "${ANDROID_HOME:-$HOME/Android/Sdk}"/build-tools/* | sort -V | tail -1)
"$BUILD_TOOLS/apksigner" verify --print-certs "$APK" | grep -E "Signer #1 certificate (DN|SHA-256)"
ls -la "$APK"
