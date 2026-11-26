# OpenNews – Funktionen, Architektur und Konfiguration (`0.2.0`)

Diese Referenz dokumentiert alle Funktionen, Verzeichnisse, Speicher-Schlüssel, Umgebungsvariablen und API-Endpunkte von OpenNews.

## Funktionsübersicht

| Bereich | Umfang |
| --- | --- |
| **Quellen** | 165 vorkonfigurierte Feeds in 6 Sprachen (DACH, UK/US/Global, Frankreich, Spanien/Lateinamerika, Italien, Portugal/Brasilien) inkl. YouTube-Kanälen, Shorts & Podcasts sowie 13 Starterpaketen und beliebig vielen eigenen Feeds; keine Vorauswahl |
| **Quellensuche & OPML** | Gewichtete Relevanzsuche nach Medium, Domain, Region, Sprache, Thema und Format; Domain-Erkennung (`link rel="alternate"`); OPML-Import & -Export (`src/lib/opml.ts`) |
| **Mehrsprachigkeit** | 6 App-Sprachen (`de`, `en`, `fr`, `es`, `it`, `pt`) mit automatischer Systemerkennung und lokalisierten Datumsformaten |
| **Feed-Formate** | RSS 2.0, RSS 1.0/RDF, Atom 1.0, JSON Feed 1.0/1.1, Podcast-Feeds (`src/lib/rssParser.ts`) |
| **Startseite** | **Heute** (Titelseite mit Aufmacher, Schlagzeilen, Ressortfilter & Dubletten-Cluster), **Für dich** (48 h, lokal personalisiert), **Neueste** (streng chronologisch), Ungelesen-Filter, Pull-to-Refresh, Wischgeste „Weniger davon“ |
| **Personalisierung** | Likes, Dislikes, Lesezeichen, Lesezeit und Lesehistorie passen lokale Gewichte an (21-Tage-Zerfall; „Neueste“ bleibt chronologisch) |
| **Artikel-Reader** | Feed-Zusammenfassung als Standard, **Opt-in-Volltext pro Quelle**, Lesefortschritt & Weiterlesen-Hinweis, Vor-/Zurück-Tastaturkürzel, Kapitel-Sprungleiste, Paywall-Alternativen, **Zeitungsmodus** (2-Spalten-Layout), Lesethemen (Papier / Sepia / Nacht / Standard), Zitate/Markierungen und Lese-Warteschlange |
| **Vorlesen (TTS)** | Szenario-bezogene Stimmen (**Artikel**, **Tagesüberblick**, **Fokus**) mit Systemstimme (offline) oder optionalem eigenem API-Key (Google Gemini, OpenAI, ElevenLabs, Custom HTTPS) |
| **Video, Audio & Radio** | Medien-Hub (`Alle`, `Videos`, `Audio`, `Radio`, `Clips`), 50 geprüfte HTTPS-Radiosender (`src/lib/radioCatalog.ts`), Weiterhören-Regal, persistenter Mini-Audio-Player inkl. Schlaftimer, Vollbild-Clips-Feed |
| **Optionale KI & Briefings** | Lokale Artikeltyp-Erkennung, Clickbait-Filter, Story-Radar, Tagesüberblick ohne API-Key, optionales BYOK für Zusammenfassungsstile, „Frag den Artikel“, Perspektivenvergleich, Medientranskripte & Wochenrückblick |
| **Feature-Flags** | Optionale Module (`dailyBriefing`, `liveRadio`, `clips`, `weeklyReview`, `cloudTts`, `pushMonitor`, `androidAuto`) über `src/lib/featureFlags.ts` in den Einstellungen schaltbar |
| **Android & Widget** | Capacitor-8-WebView, `SecureSecrets` (Android Keystore AES-256-GCM), scrollbares Homescreen-Widget mit LRU-Thumbnail-Cache, Android Auto (`OpenNewsAutoMediaService`) und stromsparender Push-Monitor (`30`/`60` Min.) |
| **Speicher & Sicherung** | Schema-Version `2` mit automatischer Migration (`storageMigrations.ts`), Quota-Bereinigung bei vollem Browser-Speicher (`storage.ts`) und JSON-Export/-Import bis 5 MB |

**Aufbewahrung:** 2, 4, 7, 14, 30 oder 90 Tage (Standard **4**), maximal **420** Beiträge im Speicher.

## Projektstruktur

- `src/App.tsx`: Zentrale Navigation, Modal-Orchestrierung und Fehlerhinweise.
- `src/hooks/`: Ausgelagerte State- und Speicher-Hooks (`usePreferences.ts`, `useSources.ts`, `useAIConfig.ts`, `useReaderSettings.ts`, `useNotifications.ts`, `useArticleStorage.ts`, `useLocalStorage.ts`, `usePWAInstall.ts`).
- `src/components/`: UI-Komponenten inklusive modularer Unterordner `reader/` (`ReaderToolbar`, `ReaderHeader`, `ReaderChapterBar`, `ReaderPaywallNotice`, `ReaderSummaryDialog`, `useReaderKeyboard`), `settings/` (`SettingsAISection`, `SettingsTTSSection`, `SettingsNotificationsSection`, `SettingsFeatureFlagsCard`) und `sources/` (`CustomSourcePanel`).
- `src/lib/`: Frameworkunabhängige Fachlogik, Wörterbücher (`locales/`), Speicher-Migration (`storage.ts`, `storageMigrations.ts`), Feature-Flags (`featureFlags.ts`), Publisher-Regeln (`publisherPolicy.ts`) und API-Kern (`apiCore.ts`).
- `functions/api/[[path]].ts` & `server.ts`: Gemeinsamer `/api/*`-Endpunkt für Cloudflare Pages Functions und Express.
- `native/android/`: Native Android-Erweiterungen, Widget, Push-Monitor, Android Auto, `NativeDiagnostics.java` und JUnit-4-Tests (`native/android/test/OpenNewsAndroidUnitTests.java`).
- `apps/website/`: Produktwebsite für Cloudflare Pages (`npm run verify`).
- `scripts/`: `build-pages.mjs`, `check-web-budget.mjs`, `check-docs-metrics.mjs`, `check-feeds.mjs`, `push-news.ts`.
- `e2e/`: Playwright-Browsertests (`core-flow.spec.ts`, `news.spec.ts`, `full-walkthrough.spec.ts`).

## Server-API (`/api/*`)

| Methode | Route | Eingabe | Ausgabe |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | `{ ok: true, service: "OpenNews" }` |
| `POST` | `/api/feeds/fetch` | `{ feeds: NewsSource[], force?: boolean }` | `{ articles, feedStatuses }` (90 s Cache in Express, `force: true` umgeht ihn) |
| `GET` | `/api/feeds/discover?q=` | URL oder Domain | `{ discovered: [{ name, url, format }] }` |
| `GET` | `/api/article/extract?url=` | Artikel-URL (optional `title`) | `{ paragraphs, headingIndexes, ogImage, unavailable?, blockedWall?, optOut? }` (ohne Server-Volltext-Cache) |
| `POST` | `/api/ai/proxy` | `{ provider, apiKey, model, prompt, customEndpoint? }` | `{ text }` oder `{ error }` |
| `POST` | `/api/tts/proxy` | `{ provider, apiKey, model, voice, text, stylePrompt?, speed?, language?, customEndpoint? }` | Binär-Audio oder `{ error }` |
| `GET` / `POST` | `/api/diagnostics` | `{ event }` | `{ enabled }` bzw. `204` (nur aktiv mit `OPENNEWS_DIAGNOSTICS=1`) |

**Schutzgrenzen:** Beide Serverpfade (`src/lib/apiCore.ts`) erzwingen `Origin`-/`Sec-Fetch-Site: same-origin`-Prüfungen (außer `/api/health`), Rate-Limiting (`65` API-, `10` KI-, `20` TTS-Anfragen/Min.), SSRF-/Privat-IP-Blockierung, Redirect-Header-Bereinigung und Secret-Redaction in Fehlermeldungen. Express ergänzt DNS-Pinning (`src/lib/publicHttp.ts`).

## Umgebungsvariablen

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `PORT` | `3000` | Port des Express-Servers |
| `NODE_ENV` | nicht gesetzt | `production` liefert `dist/` aus und aktiviert CSP/HSTS |
| `DISABLE_HMR` | nicht gesetzt | `true` deaktiviert Vite-HMR im Entwicklungsmodus |
| `OPENNEWS_ORIGIN` | Anfrage-Host | Erlaubte Origin für `/api/*` hinter einem Reverse-Proxy |
| `OPENNEWS_TRUST_PROXY` | nicht gesetzt | Kommagetrennte Reverse-Proxy-IPs/CIDRs |
| `OPENNEWS_DIAGNOSTICS` | nicht gesetzt | `1` aktiviert den anonymisierten Diagnose-Empfang unter `/api/diagnostics` |
| `OPENNEWS_OPTOUT_DOMAINS` | nicht gesetzt | Kommagetrennte Verlags-Domains für Volltext-Sperre |
| `OPENNEWS_FIREBASE_PROJECT` | nicht gesetzt | Firebase-Projekt-ID für `npm run push:worker` |
| `OPENNEWS_PUSH_STATE` | `./opennews-push-state.json` | Statusdatei des Push-Workers |

## Lokaler Speicher

| Schlüssel | Inhalt |
| --- | --- |
| `opennews_storage_schema_version` | Aktuelle Schema-Version (`2`) |
| `opennews_preferences` | Darstellung, Startseite, Aufbewahrung, Themen |
| `opennews_feature_flags` | Schaltzustand der 7 optionalen v0.2-Module |
| `opennews_fulltext_sources` | Explizite Opt-in-Liste der Quellen für Volltext-Extraktion |
| `opennews_sources`, `opennews_profile` | Abonnierte Quellen, eigene Feeds, Reaktionen, Lesezeichen, Gewichte |
| `opennews_ai_config`, `opennews_tts_config` | Konfiguration für KI & TTS; API-Keys im Web in `sessionStorage` (Opt-in `opennews_persist_web_keys`), auf Android verschlüsselt in `SecureSecrets` |
| `opennews_cached_articles`, `opennews_saved_articles`, `opennews_read_articles` | Feed-Cache (max. 420), Offline-Kopien, Leseverlauf |
| `opennews_notifications`, `opennews_feed_health`, `opennews_formats` | Push-Regeln (`30`/`60` Min.), Feed-Status, Medienformate |
| `opennews_highlights`, `opennews_reading_queue`, `opennews_reading_progress`, `opennews_audio_positions` | Markierungen, Warteschlange, Lesefortschritt, Podcast-Positionen |
| IndexedDB `opennews-ai` | Befristete lokale KI-Ergebnisse (max. 150 Einträge) |

## Skripte

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver mit Vite-Middleware (`http://localhost:3000`) |
| `npm run lint` | TypeScript-Prüfung (`tsc --noEmit`) |
| `npm test` | Alle Web-Unit-Tests (`src/lib/*.test.ts`) |
| `npm run test:coverage` | Unit-Tests inklusive Node-Coverage-Auswertung |
| `npm run build` | Produktionsbuild nach `dist/` inklusive PWA |
| `npm run build:pages` | Website + Web-App für Cloudflare Pages in `dist-pages/` |
| `node scripts/check-web-budget.mjs` | Prüft initiales JavaScript-Budget (`<= 170 KiB` gzip) |
| `node scripts/check-docs-metrics.mjs` | Prüft README-Länge (< 250 Zeilen), Doku-Links, Changelog & Live-Metriken |
| `npm run test:e2e` | Playwright-Browsertests gegen den Produktionsbuild |
| `npm run android:sync` | Baut Web-Bundle und synchronisiert Capacitor + native Android-Dateien |
| `npm run android:release -- <code >` | Baut und signiert Play-Store-`.aab` |
