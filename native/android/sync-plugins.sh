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

if ! grep -q 'com.google.mlkit:genai-summarization' "$gradle"; then
  sed -i "/^dependencies {/a\    implementation 'com.google.mlkit:genai-summarization:1.0.0-beta1'" "$gradle"
fi

manifest=android/app/src/main/AndroidManifest.xml
if ! grep -q 'DailyBriefing' "$manifest"; then
  sed -i '/<\/application>/e cat native/android/briefing-manifest.xml' "$manifest"
fi
if ! grep -q 'android.permission.POST_NOTIFICATIONS' "$manifest"; then
  sed -i '/<\/manifest>/i\    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />' "$manifest"
fi
if ! grep -q 'RECEIVE_BOOT_COMPLETED' "$manifest"; then
  sed -i '/<\/manifest>/i\    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />' "$manifest"
fi

# The optional GenAI plugin checks API 26 before calling either library.
if ! grep -q 'tools:overrideLibrary' "$manifest"; then
  sed -i 's/<manifest /<manifest xmlns:tools="http:\/\/schemas.android.com\/tools" /' "$manifest"
  sed -i '/<manifest /a\    <uses-sdk tools:overrideLibrary="com.google.mlkit.genai.summarization,com.google.mlkit.genai.common" />' "$manifest"
fi
if ! grep -q 'NewsMessagingService' "$manifest"; then
  sed -i '/<\/application>/e cat native/android/push-manifest.xml' "$manifest"
fi

cp -r native/android/widget/. android/app/src/main/res/
install -Dm644 native/android/notifications/ic_stat_opennews.xml android/app/src/main/res/drawable/ic_stat_opennews.xml
if grep -q 'OpenNewsWidget' "$manifest" && ! grep -q '@style/OpenNewsWidgetSettings' "$manifest"; then
  sed -i '/<activity android:name="\.WidgetSettingsActivity"/,/<\/activity>/d' "$manifest"
  sed -i '/<receiver android:name="\.OpenNewsWidget"/,/<\/receiver>/d' "$manifest"
fi
if ! grep -q 'OpenNewsWidget' "$manifest"; then
  sed -i '/<\/application>/e cat native/android/widget-manifest.xml' "$manifest"
fi

if ! grep -q 'android.intent.action.TTS_SERVICE' "$manifest"; then
  sed -i '/<\/manifest>/e cat native/android/tts-manifest.xml' "$manifest"
fi
