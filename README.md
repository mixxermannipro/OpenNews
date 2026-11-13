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

## Native Android- & iOS-App bauen (Capacitor / GitHub Release)
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
