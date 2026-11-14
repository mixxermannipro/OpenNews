# Android für Google Play vorbereiten

Der Katalogname lautet **OpenNews**. Das Android-Paket heißt `io.opennews.app`. Eine kurze Store-Beschreibung lautet: „RSS, Artikel und Videos aus deinen Quellen in einer App.“ Die ausführliche Beschreibung kann die Ansichten Heute und Für dich, eigene RSS-Quellen, Lesezeichen und die optionale KI mit eigenem Schlüssel nennen.

## Signiertes Android App Bundle erzeugen

1. Node.js 22, Java 21 und das Android SDK für API 36 bereitstellen. Dann `npm ci`, `npm run lint`, `npm test` und `npm run build` ausführen.
2. Falls `android/` fehlt, `npx cap add android` ausführen. Danach `npm run android:sync`. Die generierte Android-Konfiguration bleibt lokal.
3. In `android/app/build.gradle` im Block `defaultConfig` die veröffentlichte Versionsbezeichnung als `versionName` setzen. Für `versionCode` eine ganze Zahl größer als bei jedem bisherigen hochgeladenen Paket wählen. `targetSdkVersion` muss mindestens 36 sein.
4. In Android Studio **Build → Generate Signed Bundle / APK → Android App Bundle** öffnen. Den Android-Release-Build mit dem Upload-Schlüssel signieren. Schlüsseldatei und Passwort außerhalb des Projekts sicher verwahren. Play App Signing in der Play Console für die Signatur der ausgelieferten APKs einrichten.
5. Das erzeugte AAB (Android App Bundle) und die verwendete Git-Revision dokumentieren. Vor dem Upload die Signatur mit `jarsigner -verify -strict <datei.aab>` prüfen. Bei selbst signierten Upload-Zertifikaten die dabei gemeldete Vertrauenskette separat prüfen und den Zertifikatfingerabdruck mit dem auf Play hinterlegten Upload-Zertifikat vergleichen.

## Store-Eintrag und Test

- Die [Datenschutzerklärung](datenschutz.md) mit dem tatsächlichen Betreiber, Datenschutzkontakt und den eingesetzten Diensten vervollständigen. Unter einer dauerhaften öffentlichen HTTPS-Adresse bereitstellen und aus der App verlinken.
- Datensicherheit, Inhaltsbewertung und die für Nachrichten-Apps geltenden Angaben in Play Console ausfüllen. Firebase und Übersetzung anhand des tatsächlichen Release-Builds prüfen.
- Aktuelle Aufnahmen für Heute, Entdecken, Leser und Video auf einem Testgerät ohne persönliche Daten erstellen. Die [vorhandenen Bilder](screenshots) dienen als Referenz für Motive.
- Vor Veröffentlichung mindestens Installation, Aktualisierung, Feed-Abruf, Leser, Offline-Verhalten, Benachrichtigungsberechtigung und die Übersetzung prüfen. Bei neuen persönlichen Entwicklerkonten gelten für die Produktionsfreigabe gegebenenfalls 12 Tester über 14 aufeinanderfolgende Tage.
- Die Rechte für die Volltextanzeige vor Veröffentlichung prüfen. Die Debug-Pipeline liefert ausschließlich Testpakete für die Abnahme.

Quellen: [Android-Zielversionen](https://support.google.com/googleplay/android-developer/answer/11926878), [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756), [Datensicherheit](https://support.google.com/googleplay/android-developer/answer/10787469), [Testvorgaben](https://support.google.com/googleplay/android-developer/answer/14151465).
