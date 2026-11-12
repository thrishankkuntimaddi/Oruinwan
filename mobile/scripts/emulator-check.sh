#!/usr/bin/env bash
# Runs the shrunk release APK on a booted emulator and fails on any crash (CI: apps.yml
# "Android (emulator check)"). Locally: start an AVD, then
#   bash mobile/scripts/emulator-check.sh path/to/shrunk-release.apk
set -uo pipefail
APK="${1:-shrunk-release.apk}"
PKG=com.oruinwan.app
OUT="${LOGCAT_OUT:-logcat.txt}"

adb install -r -d "$APK" || { echo "::error::Could not install $APK"; exit 1; }
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 20
# Deep links (App Links and oruinwan://) open screens inside the running app.
adb shell am start -a android.intent.action.VIEW -d "oruinwan://open/settings" "$PKG" >/dev/null || true
sleep 8
# Runtime permission requests go through Capacitor's plugin annotations (the 2.3.1 R8 crash).
adb shell pm revoke "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
adb shell am start -a android.intent.action.VIEW -d "oruinwan://open/settings/notifications" "$PKG" >/dev/null || true
sleep 7
adb logcat -d > "$OUT" || true

if grep -qE "FATAL EXCEPTION|AndroidRuntime: Process: $PKG" "$OUT"; then
  grep -A40 "FATAL EXCEPTION" "$OUT" | head -80
  echo "::error::The shrunk release crashed on the emulator (full log in the android-emulator-logcat artifact)"
  exit 1
fi
if ! adb shell pidof "$PKG" >/dev/null; then
  tail -80 "$OUT"
  echo "::error::The app is not running 35 s after launch"
  exit 1
fi
echo "The shrunk release started, opened deep links and is still running."
