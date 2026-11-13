# OpenNews

Datenschutzfreundliche, Apple-inspirierte Nachrichten-App für freie RSS-, Atom- und JSON-Feeds — mit lokaler Like-Personalisierung, automatischem Hell- und Dunkelmodus und optionaler Bring-Your-Own-Key (BYOK) KI-Analyse.

## Funktionen
- **Freie Nachrichtenagenturen**: Tagesschau, ZDFheute, Deutschlandfunk, FAZ, Der Spiegel, ZEIT ONLINE, Süddeutsche Zeitung, Handelsblatt, WELT, BILD, Heise Online, Golem.de, t3n, The Guardian, BBC World News, Hacker News, Ars Technica, NASA u. v. m.
- **Eigene RSS-/Atom-/JSON-Feeds**: Beliebige Feed-URLs hinzufügen, aktivieren oder pausieren.
- **100 % Lokal auf dem Gerät**: Abos, Likes, Lesezeichen, Algorithmus-Gewichte, Benachrichtigungsregeln und API-Keys verbleiben im lokalen Speicher deines Geräts.
- **Like-Algorithmus ("Für dich")**: Sortiert nach Aktualität, Eilmeldungen und deinen Interessen. Likes zählen stärker als Lesezeit. Die Liste mischt Themen und Quellen.
- **Eigene KI-Integration (BYOK)**: Unterstützt Google AI Studio (Gemini), OpenAI, Anthropic (Claude), Mistral AI sowie OpenRouter / eigene OpenAI-kompatible Endpunkte (z. B. lokales Ollama).
- **Medien & Reader**: Bilder, Videos/Podcasts, anpassbare Schriftgröße (`A | A`), Serif/Sans-Switch, Volltext-Extraktion und ein animiertes Fenster für die Zusammenfassung, auch ohne API-Key.

## Startseite und Aufbewahrung

- **Heute** priorisiert die wichtigsten verfügbaren Meldungen seit Mitternacht anhand von Eilmeldungen und Aktualität. Die Auswahl mischt Themen und Quellen.
- **Für dich** empfiehlt Beiträge aus den letzten 48 Stunden anhand deiner Interessen, Quellen und Reaktionen.
- **Neueste** zeigt die verfügbaren Beiträge nach Veröffentlichungszeit. Unter **Entdecken** findest du alle Themenrubriken und die Suche.

Unter **Profil → Individuelle Einstellungen → Feed & Startseite** kannst du die Aufbewahrung auf 2, 4, 7, 14, 30 oder 90 Tage einstellen. Standard sind 4 Tage. Das Alter richtet sich nach der Veröffentlichungszeit, sofern die Quelle ein gültiges Datum liefert. Der Feed-Speicher behält bis zu 600 Beiträge. Quellenabos, Lesezeichen, gelikte Artikel und der Leseverlauf bleiben erhalten.

## Darstellung und Einrichtung

Beim ersten Start kannst du Interessen und Darstellung wählen oder direkt mit den empfohlenen Einstellungen beginnen. Im Profil findest du die Einstellungen für Farben, Transparenz, Karten, Schrift, Startseite und Bewegung. Unter „Feed und Startseite“ wählen journalistische Voreinstellungen passende Quellen aus. Die Darstellung bleibt einheitlich. Deine Änderungen werden auf dem Gerät gespeichert.

Google AI Studio bietet `gemini-flash-latest` und `gemini-flash-lite-latest` an. Google hält diese Modellnamen aktuell. Im Feld „Modell-ID“ kannst du auch eine eigene ID hinterlegen.

Der Artikeltext wird beim Öffnen automatisch von der Quelle geladen. Falls der Anbieter nur einen Ausschnitt liefert oder den Abruf einschränkt, kannst du beim Anbieter weiterlesen. Im Profil unter „Quellen“ lassen sich Abonnements als OPML importieren und exportieren.

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
npm run android:sync
cd android
./gradlew assembleDebug
```

Die Debug-APK befindet sich anschließend unter `android/app/build/outputs/apk/debug/app-debug.apk`.
