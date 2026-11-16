# Android für Google Play vorbereiten

Der Katalogname lautet **OpenNews**. Das Android-Paket heißt `io.opennews.app`. Die deutschen und englischen Beschreibungen stehen im [Store-Entwurf](play-store-listing.md).

## Signiertes Android App Bundle erzeugen

Voraussetzungen unter Linux sind Node.js 22, ein vollständiges JDK 21,
Android SDK und Build Tools für API 36, ImageMagick und `flock`.
Mit `npm ci` und den Prüfungen aus der README beginnen. `JAVA_HOME` und
`ANDROID_HOME` müssen auf das JDK bzw. Android SDK zeigen.

Beim ersten echten Paket einen dauerhaften Upload-Schlüssel erzeugen. Das
Passwort am Terminal eingeben. Schlüsseldatei und Wiederherstellungskopie
außerhalb des Projekts schützen. Das Passwort im Passwortmanager ablegen.
Google Play verwaltet später den Schlüssel, mit dem es die installierbaren
Pakete signiert. Der lokale Upload-Schlüssel dient zur Anmeldung des Pakets.

```sh
umask 077
mkdir -p "$HOME/.local/share/opennews-signing"
export OPENNEWS_UPLOAD_KEYSTORE="$HOME/.local/share/opennews-signing/upload.p12"
export OPENNEWS_UPLOAD_ALIAS=opennews-upload
keytool -genkeypair -storetype PKCS12 -keystore "$OPENNEWS_UPLOAD_KEYSTORE" \
  -alias "$OPENNEWS_UPLOAD_ALIAS" -keyalg RSA -keysize 2048 -validity 10000
```

Für jedes Paket von einem sauberen Checkout aus arbeiten. Für den ersten
Play-Upload kann der Versionscode 1 verwendet werden, sofern er in Play
Console frei ist. Für weitere Uploads eine Zahl über dem höchsten bereits
verwendeten Code wählen. `versionName` stammt aus `package.json`.

```sh
npm run android:release -- 1
```

Der Befehl erzeugt und synchronisiert das Android-Projekt, baut das
Release-Bundle, fragt das Passwort verdeckt ab und prüft die Signatur mit
`jarsigner -verify -strict` gegen das gewählte Upload-Zertifikat. Er legt das
geprüfte Paket unter `build/android-release/OpenNews-1.aab` ab und gibt den
SHA-256-Zertifikatfingerabdruck aus. Einen bereits vorhandenen Versionscode
überschreibt er am Ausgabeort nicht. Im PR prüft GitHub denselben Weg mit einem
Einmalschlüssel. Das Paket aus dieser Prüfung bleibt auf dem Runner.

Für den vorgeschlagenen ersten Beta-Build einen frischen Android-Baum ohne
`android/app/google-services.json` verwenden. Das Firebase-SDK bleibt derzeit
im Paket. Android-Cloud-Backups sind deaktiviert. Greife für eine manuelle
Sicherung auf die Exportfunktion in der App zurück. Vor dem finalen Datensicherheitsformular das Update- und
Netzwerkverhalten des konkreten Buildstands prüfen.

## Freigabe protokollieren

Für jedes Paket den Commit, `versionName`, `versionCode`, die Ziel-API und den Fingerabdruck des Upload-Zertifikats im Freigabeprotokoll festhalten. Das AAB (Android-App-Paket für Google Play) lokal erzeugen. Bei einer Neuinstallation aus dem internen Testkanal und bei einem Update von dessen voriger Version prüfen, dass die App gestartet werden kann und Abos, Verlauf und Einstellungen erhalten bleiben.

- [ ] Versionscode gegen den höchsten bereits hochgeladenen Code in Play Console geprüft.
- [ ] Signiertes Paket geprüft und Fingerabdruck mit dem Upload-Zertifikat in Play Console abgeglichen.
- [ ] Betreiber, Datenschutzkontakt und öffentliche HTTPS-Datenschutzseite eingetragen und im Release-Build erreichbar.
- [ ] Store-Texte, aktuelle Screenshots und Pflichtangaben hinterlegt.
- [ ] Installation und Update aus dem internen Testkanal geprüft.

Der lokale Debug-Build und das CI-Testpaket haben unterschiedliche Signaturen. Bei einem Update muss die Signatur der installierten App passen. Für die Abnahme im Play-Testkanal dieselbe App-Signatur wie bei späteren Store-Updates verwenden.

## Ziel-API und 16-KB-Seitengröße prüfen

Verwende für die Abnahme das signierte App Bundle aus dem Freigabeprotokoll. Prüfe seine Einstellungen und das zusammengeführte Manifest mit Androids `bundletool`.

```sh
bundletool dump config --bundle=opennews-release.aab
bundletool dump manifest --bundle=opennews-release.aab --module=base
```

In der Konfiguration muss `PAGE_ALIGNMENT_16K` stehen. Das Manifest muss die Ziel-API 36 und die für diesen Build erwarteten Berechtigungen ausweisen. Prüfe in den für Play erzeugten APKs zusätzlich den ZIP-Container und die `LOAD`-Segmente der eingebetteten 64-Bit-Bibliotheken. `zipalign` wird auf die APK angewendet. Die Segment-Ausrichtung zeigt die letzte Spalte der `LOAD`-Zeilen an. Sie muss mindestens `0x4000` sein.

```sh
zipalign -c -P 16 4 opennews-universal.apk
readelf -lW libtranslate_jni.so
```

Starte anschließend ein Android-Gerät oder einen Emulator mit 16-KB-Seiten. `adb shell getconf PAGE_SIZE` muss `16384` melden. Teste Installation, Startseite, Leser und die lokale Übersetzung. Lies nach dem Upload den Vorabtestbericht in Play Console und notiere offene Befunde im Freigabeprotokoll. [Android-Anleitung zur 16-KB-Prüfung](https://developer.android.com/guide/practices/page-sizes)

### Prüfung vom 15. November 2026

- Das GitHub-Test-APK aus PR #134 meldet Ziel-API 36. `zipalign -c -P 16 4` war erfolgreich.
- Ein unsignierter lokaler Release-Build mit dem Stand von `fix/tagesueberblick` meldet `PAGE_ALIGNMENT_16K` und Ziel-API 36. Die `LOAD`-Segmente von `libdatastore_shared_counter.so` und `libtranslate_jni.so` sind in beiden Artefakten für `arm64-v8a` und `x86_64` auf `0x4000` ausgerichtet.
- Beide Manifeste enthalten Internet, Netzwerkstatus, Benachrichtigungen, Neustart-Empfang, AICore-Dienstbindung, Wake-Lock, Firebase-Empfang und eine paketinterne Receiver-Berechtigung.
- Das angeschlossene Samsung meldet 4.096 Byte Seitengröße. Der 16-KB-Laufzeittest, das signierte Upload-Paket und der Play-Vorabtestbericht stehen aus.

### Lokaler Vorlauf auf `main` vom 16. November 2026

- Ausgangspunkt `23d2157`. Android-Sync und Manifest-Zusammenführung erfolgreich:
  Paket `io.opennews.app`, Minimum API 24, Ziel-API 36, Name `0.1.0-alpha.1`,
  probeweise Code 17. Die acht oben genannten Berechtigungen waren vorhanden.
  `allowBackup=false` wurde im zusammengeführten Manifest geprüft.
- Mit einem temporären PKCS12-Schlüssel bestand ein Probe-Archiv nach dem
  Signieren die strenge Signaturprüfung. Der lokale Paketbau scheiterte mit
  `invalid source release: 21`, da lokal JDK 17 für Gradle verfügbar war.
- Typprüfung, 66 Unit-Tests, Web-Build und 13 Playwright-Tests waren erfolgreich.
  Die automatisierten Playwright-Tests nutzen vorbereitete Feeds. Der
  [separate Web-Vorlauf mit echten Feeds](beta-product-validation.md#vorprüfung-mit-echten-feeds)
  ersetzt die Android-Messung für #141 nicht. Zum Zeitpunkt der Prüfung war
  kein Gerät verbunden.
- Ausstehend sind die Abnahme am endgültigen signierten Paket, die Laufzeit
  mit 16-KB-Seitengröße, Neuinstallation und Update aus Google Play und der
  Play-Vorabtestbericht.

## Store-Eintrag und Test

- Die [Datenschutzerklärung](datenschutz.md) mit dem tatsächlichen Betreiber, Datenschutzkontakt und den eingesetzten Diensten vervollständigen. Unter einer dauerhaften öffentlichen HTTPS-Adresse bereitstellen und aus der App verlinken.
- Datensicherheit, Inhaltsbewertung und die für Nachrichten-Apps geltenden Angaben in Play Console ausfüllen. Firebase und Übersetzung anhand des tatsächlichen Release-Builds prüfen.
- Aktuelle Aufnahmen für Heute, Entdecken, Leser und Video auf einem Testgerät ohne persönliche Daten erstellen. Die [README-Aufnahmen](../README.md#screenshots) zeigen die Web-App im Handyformat und dienen als Referenz für die Motive.
- Vor Veröffentlichung mindestens Installation, Aktualisierung, Feed-Abruf, Leser, Offline-Verhalten, Benachrichtigungsberechtigung und die Übersetzung prüfen. Bei neuen persönlichen Entwicklerkonten gelten für die Produktionsfreigabe gegebenenfalls 12 Tester über 14 aufeinanderfolgende Tage.
- Die Rechte für die Volltextanzeige, Feed-Teaser, Bilder, Marken- und Quellendarstellung und Store-Aufnahmen vor der Verteilung prüfen. § 87g UrhG unterscheidet Hyperlinks und sehr kurze Auszüge von anderen Nutzungen. Ein öffentlich erreichbarer Feed allein belegt keine Freigabe für Volltexte oder Bilder. Vor der Beta die freigegebenen Nutzungen bestätigen und bei Bedarf die Anzeige auf Quellenangabe und Original-Link begrenzen. [§ 87g UrhG](https://www.gesetze-im-internet.de/urhg/__87g.html) Die Debug-Pipeline liefert ausschließlich Testpakete für die Abnahme.

Quellen: [Android-Zielversionen](https://support.google.com/googleplay/android-developer/answer/11926878), [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756), [Datensicherheit](https://support.google.com/googleplay/android-developer/answer/10787469), [Testvorgaben](https://support.google.com/googleplay/android-developer/answer/14151465).
