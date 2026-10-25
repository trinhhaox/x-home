#!/bin/bash
# Builds the Android APK: compiles web UI (Vite) + builds native Android shell via Gradle.
# Output: build/Xhome-<version>.apk
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(sed -n 's/^MARKETING_VERSION *= *//p' "$ROOT/ios/Config/Base.xcconfig")"
APK_OUT="$ROOT/build/Xhome-$VERSION.apk"

echo "▸ Building web UI"
cd "$ROOT/web"
[ -d node_modules ] || npm install
npm run build --silent

echo "▸ Copying web bundle to Android assets"
ASSETS_DIR="$ROOT/android/app/src/main/assets/web"
rm -rf "$ASSETS_DIR"
mkdir -p "$ASSETS_DIR"
cp -R "$ROOT/web/dist/"* "$ASSETS_DIR/"

echo "▸ Building Android APK (Release)"
cd "$ROOT/android"
export ANDROID_HOME="${ANDROID_HOME:-/Volumes/XcodeExternal/Android/sdk}"
./gradlew assembleRelease --no-daemon

BUILT_APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
if [ ! -f "$BUILT_APK" ]; then
  # Fallback check for debug APK if release failed
  BUILT_APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
fi

if [ -f "$BUILT_APK" ]; then
  mkdir -p "$ROOT/build"
  cp "$BUILT_APK" "$APK_OUT"
  (cd "$ROOT/build" && shasum -a 256 "$(basename "$APK_OUT")") > "$APK_OUT.sha256"
  echo "✓ Built Android APK: $APK_OUT"
  cat "$APK_OUT.sha256"
else
  echo "Build failed: output APK not found"
  exit 1
fi
