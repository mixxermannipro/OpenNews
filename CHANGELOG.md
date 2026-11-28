# Changelog

Alle wesentlichen Änderungen an **OpenNews** werden in dieser Datei dokumentiert. Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/) und [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Geändert
- **Relizenzierung auf AGPL-3.0-or-later:** Wechsel von „Source Available“ / `UNLICENSED` auf die Open-Source-Lizenz **AGPL-3.0-or-later** (`LICENSE`, `LICENSES/AGPL-3.0-or-later.txt`, `package.json`, `apps/website/package.json`). Bis Commit `d6cd0de2ab7fe5c97678fc9a04e62d2ee5dcd839` bleibt die Historie unter `Apache-2.0`.
- **Beitragsmodell (DCO):** `CONTRIBUTING.md` auf das Developer Certificate of Origin (`git commit -s`) umgestellt.

### Hinzugefügt
- **REUSE- & Marken-Dokumentation:** `REUSE.toml`, `LICENSES/OFL-1.1.txt` für die Web-Schriften sowie `TRADEMARKS.md` (Name und Logo von OpenNews bleiben geschützt).
- **AGPL-§13-Quellcode-Link:** Link „Quellcode“ auf das GitHub-Repository (konfigurierbar über `VITE_SOURCE_URL` in `.env.example`) im Website-Footer sowie in der App unter **Einstellungen → Über** (Web und Android).

## [0.2.0] - 2026-11-26

### Hinzugefügt
- **Schlankere Architektur & Modularisierung:** Auslagerung zentraler App-Hooks (`usePreferences`, `useSources`, `useAIConfig`, `useReaderSettings`, `useNotifications`), fokussierter Reader-Komponenten (`src/components/reader/`), Einstellungs-Module (`src/components/settings/`), benutzerdefinierter Quellen (`src/components/sources/`) sowie sprachspezifischer Wörterbücher (`src/lib/locales/de.ts`).
- **Speicher-Resilienz & Schema-Migrationen:** Neue Speicher-Schicht (`src/lib/storage.ts`, `src/lib/storageMigrations.ts`) mit Schema-Version `2`, automatischer Bereinigung bei `QuotaExceededError` inkl. Nutzerhinweis, LRU-Begrenzung im KI-Cache und 5-MB-Backup-Validierung.
- **Konfigurierbare Feature-Flags:** Optionale Module (`dailyBriefing`, `liveRadio`, `clips`, `weeklyReview`, `cloudTts`, `pushMonitor`, `androidAuto`) lassen sich über `src/lib/featureFlags.ts` und die Einstellungen einzeln aktivieren oder deaktivieren, während Kernfunktionen (Quellen, Feed, Reader, Personalisierung, Widget, Sicherung) dauerhaft aktiv bleiben (`PRODUCT.md`).
- **Sicherheit & API-Parität:** Gemeinsamer API-Kern (`src/lib/apiCore.ts`) für Cloudflare Pages Functions und Express mit strenger Origin-/Fetch-Metadata-Prüfung, Rate-Limiting, SSRF-/Redirect-Schutz, Secret-Redaction, Verlags-Opt-out/Paywall-Respekt (`src/lib/publisherPolicy.ts`) und explizitem Quellen-Opt-in für den Artikelvolltext.
- **Flüchtiger Web-Schlüsselspeicher:** Im Web werden API-Schlüssel standardmäßig nur in `sessionStorage` gehalten (`src/lib/webSecretStorage.ts`); dauerhaftes Speichern im Browser ist opt-in.
- **Native Android-Härtung & Tests:** Anonymisierte lokale Fehlerzähler (`NativeDiagnostics.java`), Abfangen unerwarteter Ausnahmen in Widget-, Push- und Android-Auto-Diensten, zusätzliche JUnit-Tests sowie Dokumentation zu Android Vitals und 30/60-Minuten-Intervallen (`docs/android-release.md`).
- **Qualität & Dokumentation:** Durchgehender E2E-Kernablauf (`e2e/core-flow.spec.ts`), `npm run test:coverage` in der CI, automatischer Feed-Gesundheits-Check (`scripts/check-feeds.mjs`), rechtlicher Leitfaden (`docs/quellen-rechte.md`), detaillierte Funktionsreferenz (`docs/funktionen.md`) und Doku-Metrikprüfung (`scripts/check-docs-metrics.mjs`).

### Geändert
- **Stromsparendes Push-Intervall:** Das Hintergrund-Intervall für den Android-Push-Monitor unterstützt nun stromsparende feste Werte von `30` oder `60` Minuten.
- **Plattform-Transparenz:** Expliziter Hinweis in App-Produktbeschreibung, Dokumentation und Website, dass **iOS / WidgetKit** derzeit ungebaut und nicht verfügbar ist.
- **Abhängigkeiten & Node-Version:** Node.js `>=22` in `package.json`/`.nvmrc`/`.npmrc` festgeschrieben, Build-Tools in `devDependencies` verschoben, ungenutztes `@google/genai` entfernt, Dependabot und `npm audit --omit=dev` aktiviert.

## [0.1.0-alpha.1] - 2026-11-21

### Hinzugefügt
- Erste öffentliche Vorabversion von OpenNews für Web/PWA und Android (Capacitor 8) mit 165 kuratierten RSS-/Atom-/JSON-/Podcast-Feeds, 50 Live-Radiosendern, Reader mit Vorlesen, lokalem Ranking, Tagesüberblick, Android-Homescreen-Widget und Android Auto.
