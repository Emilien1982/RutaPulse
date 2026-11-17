#!/bin/bash
# Builds the signed release APK (arm64-v8a only) into mobile/apk/. ADR 0022.
# Run from mobile/ (npm run build:apk). It never installs anything.
set -euo pipefail

cd "$(dirname "$0")/.."

export RUTAPULSE_SIGNING="${RUTAPULSE_SIGNING:-$HOME/.rutapulse/signing.properties}"
if [ ! -f "$RUTAPULSE_SIGNING" ]; then
  echo "Fichier de signature introuvable : $RUTAPULSE_SIGNING" >&2
  echo "Voir docs/installer-sur-un-telephone.md (RUTAPULSE_SIGNING)." >&2
  exit 1
fi
# Absolute path: Gradle runs from android/app/, not from mobile/.
RUTAPULSE_SIGNING="$(cd "$(dirname "$RUTAPULSE_SIGNING")" && pwd)/$(basename "$RUTAPULSE_SIGNING")"
export RUTAPULSE_SIGNING

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
APKSIGNER="$(ls -d "$ANDROID_HOME"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1 || true)"
if [ -z "$APKSIGNER" ]; then
  echo "apksigner introuvable dans $ANDROID_HOME/build-tools" >&2
  exit 1
fi

VERSION="$(node -p "require('./app.json').expo.version")"
BUILD="$(node -p "require('./app.json').expo.android.versionCode")"
OUT="apk/RutaPulse-$VERSION-$BUILD.apk"
if [ -e "$OUT" ]; then
  echo "$OUT existe déjà : augmenter android.versionCode dans app.json, ou supprimer le fichier à la main." >&2
  exit 1
fi
COMMIT="$(git rev-parse --short HEAD)"
DIRTY=""
if [ -n "$(git status --porcelain)" ]; then
  DIRTY=" (ATTENTION : modifications non commitées)"
fi

npx expo prebuild --platform android --no-install
(cd android && ./gradlew app:assembleRelease -PreactNativeArchitectures=arm64-v8a)

mkdir -p apk
cp android/app/build/outputs/apk/release/app-release.apk "$OUT"

CERTS="$("$APKSIGNER" verify --print-certs "$OUT")" || { rm -f "$OUT"; exit 1; }
# Lock 3: never hand out an APK signed by the debug key.
if grep -q "CN=Android Debug" <<<"$CERTS"; then
  rm -f "$OUT"
  echo "ÉCHEC : l'APK est signé par la clé de débogage, il est supprimé." >&2
  exit 1
fi

echo "APK : $PWD/$OUT"
echo "Taille : $(du -h "$OUT" | cut -f1) ($(wc -c < "$OUT" | tr -d ' ') octets)"
echo "Commit : $COMMIT$DIRTY"
echo "Date : $(date '+%Y-%m-%d %H:%M:%S')"
echo "SHA-256 du fichier : $(shasum -a 256 "$OUT" | cut -d' ' -f1)"
echo "$CERTS"
