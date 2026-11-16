#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

version_code=${1:-}
if [[ $# != 1 || ! $version_code =~ ^[1-9][0-9]{0,9}$ ]] || (( version_code > 2100000000 )); then
  echo "Usage: npm run android:release -- <versionCode from 1 to 2100000000>" >&2
  exit 2
fi

: "${OPENNEWS_UPLOAD_KEYSTORE:?Set the absolute path to your local PKCS12 upload keystore}"
: "${OPENNEWS_UPLOAD_ALIAS:?Set the upload key alias}"

if [[ $OPENNEWS_UPLOAD_KEYSTORE != /* || ! -f $OPENNEWS_UPLOAD_KEYSTORE ]]; then
  echo "The upload keystore must be an existing file at an absolute path." >&2
  exit 2
fi
keystore=$(realpath -- "$OPENNEWS_UPLOAD_KEYSTORE")
if [[ $keystore == "$(pwd -P)/"* ]]; then
  echo "Keep the upload keystore outside the repository." >&2
  exit 2
fi

jarsigner=${JAVA_HOME:+$JAVA_HOME/bin/}jarsigner
keytool=${JAVA_HOME:+$JAVA_HOME/bin/}keytool
command -v "$jarsigner" >/dev/null
command -v "$keytool" >/dev/null

# Serialize releases from this checkout so one Gradle build cannot replace another's input.
mkdir -p build/android-release
exec 9>build/android-release/.lock
flock 9
signed_bundle="build/android-release/OpenNews-$version_code.aab"
if [[ -e $signed_bundle ]]; then
  echo "A signed bundle with versionCode $version_code already exists: $signed_bundle" >&2
  exit 2
fi

if [[ ! -d android ]]; then
  npm run build
  npx cap add android
fi
npm run android:sync
(cd android && ./gradlew :app:bundleRelease "-PopenNewsVersionCode=$version_code" --no-daemon)

unsigned_bundle=android/app/build/outputs/bundle/release/app-release.aab
work_dir=$(mktemp -d build/android-release/.signing.XXXXXXXX)
trap 'rm -f -- "$work_dir/signed.aab"; rmdir -- "$work_dir"' EXIT
# Read once, without echo. Pass the password only in the signing tools' environment.
IFS= read -r -s -p 'Upload keystore password: ' upload_password
if [[ -t 0 ]]; then printf '\n' >&2; fi
OPENNEWS_SIGNING_PASSWORD="$upload_password" "$jarsigner" \
  -storetype PKCS12 -keystore "$keystore" -storepass:env OPENNEWS_SIGNING_PASSWORD \
  -signedjar "$work_dir/signed.aab" "$unsigned_bundle" "$OPENNEWS_UPLOAD_ALIAS"
OPENNEWS_SIGNING_PASSWORD="$upload_password" "$jarsigner" \
  -verify -strict -storetype PKCS12 -keystore "$keystore" -storepass:env OPENNEWS_SIGNING_PASSWORD \
  "$work_dir/signed.aab" "$OPENNEWS_UPLOAD_ALIAS"
OPENNEWS_SIGNING_PASSWORD="$upload_password" "$keytool" \
  -list -storetype PKCS12 -keystore "$keystore" -storepass:env OPENNEWS_SIGNING_PASSWORD \
  -alias "$OPENNEWS_UPLOAD_ALIAS"
unset upload_password

# Publish locally only after verification. A hard link fails if another build already wrote this code.
ln -T -- "$work_dir/signed.aab" "$signed_bundle"
git rev-parse HEAD
node -p 'require("./package.json").version'
printf 'versionCode=%s\n%s\n' "$version_code" "$signed_bundle"
