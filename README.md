# OpenNews

Datenschutzfreundliche, Apple-inspirierte Nachrichten-App für freie RSS-, Atom- und JSON-Feeds — mit lokaler Like-Personalisierung, Dark Mode als Standard und optionaler Bring-Your-Own-Key (BYOK) KI-Analyse.

## Funktionen
- **Freie Nachrichtenagenturen**: Tagesschau, ZDFheute, Deutschlandfunk, FAZ, Der Spiegel, ZEIT ONLINE, Süddeutsche Zeitung, Handelsblatt, WELT, BILD, Heise Online, Golem.de, t3n, The Guardian, BBC World News, Hacker News, Ars Technica, NASA u. v. m.
- **Eigene RSS-/Atom-/JSON-Feeds**: Beliebige Feed-URLs hinzufügen, aktivieren oder pausieren.
- **100 % Lokal auf dem Gerät**: Abos, Likes, Lesezeichen, Algorithmus-Gewichte, Benachrichtigungsregeln und API-Keys verbleiben im lokalen Speicher deines Geräts.
- **Like-Algorithmus ("Für dich")**: Lernt lokal anhand von Likes, Lesezeichen und Lesezeit, welche Themen, Anbieter und Schlagwörter dich interessieren.
- **Eigene KI-Integration (BYOK)**: Unterstützt Google AI Studio (Gemini), OpenAI, Anthropic (Claude), Mistral AI sowie OpenRouter / eigene OpenAI-kompatible Endpunkte (z. B. lokales Ollama).
- **Medien & Reader**: Bilder, Videos/Podcasts, anpassbare Schriftgröße (`A | A`), Serif/Sans-Switch, Volltext-Extraktion und lokale Textzusammenfassung ohne API-Key.

## Entwicklung & Start (Web / PWA)
```bash
npm install
npm run dev
```

## Android-Testbuild (private Pre-Alpha)

Die Android-Version ist ein **Debug-Build ausschließlich zum eigenen Testen**, keine produktionsreife App.

- Unter [GitHub Actions](https://github.com/mixxermannipro/OpenNews/actions/workflows/android-test-apk.yml) kann der Workflow `OpenNews Android Test APK` manuell gestartet werden (`Run workflow` auf `main`). Beim ersten Merge dieser Workflow-Datei wird einmalig ein Build gestartet.
- Nach einem erfolgreichen Build liegt die APK als **privates Pre-Release** unter [GitHub Releases](https://github.com/mixxermannipro/OpenNews/releases); in PRs ist sie ausschließlich als kurzlebiges Actions-Artefakt verfügbar.
- Datei `OpenNews-debug.apk` auf dein Android-Gerät herunterladen und öffnen. Android kann nach einer Erlaubnis für die Installation aus dieser Quelle fragen.
- Alle Debug-Builds sind mit einem lokalen CI-Debug-Schlüssel signiert. Folgeversionen aus separaten CI-Läufen können wegen unterschiedlicher Signaturen **nicht über eine alte APK installiert** werden; dazu die vorherige Version deinstallieren (lokale App-Daten gehen dabei verloren).
- Die nativen Nachrichtenabrufe erfolgen lokal über CapacitorHttp, ohne einen mitzuliefernden Node-Server. Einige RSS-Anbieter können Anfragen blockieren. Artikelvolltext und BYOK-KI sind Beta-Funktionen.

### Lokaler Android-Build (optional)

```bash
npm install
npm run build
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

Die Debug-APK befindet sich anschließend unter `android/app/build/outputs/apk/debug/app-debug.apk`.

Dieses Repository ist direkt für [Capacitor](https://capacitorjs.com/) vorbereitet:

```bash
# 1. Web-Bundle bauen
npm run build

# 2. Capacitor CLI & Android/iOS Plattformen hinzufügen
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios

# 3. Assets synchronisieren & Android Studio / Xcode öffnen
npx cap sync
npx cap open android
```

### GitHub Actions Release
Für automatische APK-/AAB-Releases auf GitHub kann in Android Studio unter `Build > Generate Signed Bundle / APK` gebaut oder eine Gradle-Workflow-Action auf `android/` ausgeführt werden.
