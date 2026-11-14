#!/usr/bin/env bash
set -euo pipefail
cp native/android/*.java android/app/src/main/java/io/opennews/app/
gradle=android/app/build.gradle
if ! grep -q 'com.google.mlkit:translate' "$gradle"; then
  sed -i "/^dependencies {/a\    implementation 'com.google.mlkit:translate:17.0.3'" "$gradle"
fi
if ! grep -q 'com.google.firebase:firebase-messaging' "$gradle"; then
  sed -i "/^dependencies {/a\    implementation 'com.google.firebase:firebase-messaging:26.0.1'" "$gradle"
fi

manifest=android/app/src/main/AndroidManifest.xml
if ! grep -q 'NewsMessagingService' "$manifest"; then
  sed -i '/<\/application>/e cat native/android/push-manifest.xml' "$manifest"
fi

cp -r native/android/widget/. android/app/src/main/res/
if ! grep -q 'OpenNewsWidget' "$manifest"; then
  sed -i '/<\/application>/e cat native/android/widget-manifest.xml' "$manifest"
fi
