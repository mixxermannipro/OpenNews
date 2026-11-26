# OpenNews – Produktumfang (v0.2)

OpenNews bündelt Nachrichten aus selbst gewählten RSS-, Atom-, JSON- und Podcast-Feeds ohne Benutzerkonto, Werbung oder externes Tracking. Auswahl, Personalisierung, Lesezeichen und Einstellungen bleiben lokal auf dem Gerät.

## Kernfunktionen (v0.2 Core Scope)

Diese Module sind fester Bestandteil jeder OpenNews-Installation und lassen sich nicht aus Versehen abschalten:

- **Quellen & Starter-Pakete:** Durchsuchen und abonnieren von kuratierten Quellen, OPML-Import/Export und eigene Feed-URLs (`SourcesManager`).
- **Startseiten-Feed (`Heute`, `Für dich`, `Neueste`):** Personalisierte Sortierung lokal auf dem Gerät, Themenfilter und Dubletten-Clustering (`HomeView`).
- **Artikel-Reader:** Bereinigte Leseansicht, Vorlesefunktion (System-TTS), Lesezeichen, Leseliste, Typografie-Modi und **Opt-in-Volltextabruf pro Quelle** (`ArticleReaderModal`).
- **Lokale Personalisierung & Profile:** Gewichte pro Thema/Quelle/Schlagwort mit automatischem 21-Tage-Zerfall sowie Diagnose-Einblick (`Preferences`).
- **Sicherung & Import:** Versionierter Export/Import des Gerätestatus inklusive Abos, Lesezeichen und Personalisierung (`backup.ts` / `storage.ts`).
- **Android-Homescreen-Widget:** Konfigurierbares Widget für `Heute`, `Für dich` und `Neueste` (`OpenNewsWidget.java`).

## Optionale Module (über Feature-Flags steuerbar)

Alle Zusatzmodule sind standardmäßig aktiv und können in **Einstellungen → Formate & Module** oder **App & Hinweise** ein- und ausgeschaltet werden (`src/lib/featureFlags.ts`):

- **Tagesüberblick & Erinnerung (`dailyBriefing`):** Geführtes Audio-/Lese-Briefing inklusive täglicher Android-Erinnerung.
- **Live-Nachrichtenradio (`liveRadio`):** Kuratierte Live-Streams öffentlich-rechtlicher und internationaler Sender.
- **Hochformat-Clips (`clips`):** Vertikaler Video-Stream aus passenden Feed-Videos.
- **KI-Wochenrückblick (`weeklyReview`):** Lokale oder BYOK-gestützte Auswertung der gelesenen Themen.
- **Cloud-Vorlesestimmen (`cloudTts`):** Optionale externe Stimmen (Google Gemini, OpenAI, Custom) zusätzlich zur Systemstimme.
- **Hintergrund-Benachrichtigungen (`pushMonitor`):** Stromsparende Android-Feed-Prüfung alle 30 oder 60 Minuten ohne zentralen Push-Server.
- **Android Auto (`androidAuto`):** Lokaler Audio-Podcast-Katalog für das Fahrzeug.

## Plattform-Status (Stand v0.2)

- **Web-App & PWA:** Aktiv gebaut, getestet und unter Cloudflare Pages betrieben.
- **Android (Capacitor 8):** Aktiv gebaut, per JUnit und Gradle getestet und signiert für Google Play vorbereitet.
- **iOS / WidgetKit:** Derzeit **nicht gebaut, nicht auf Geräten getestet und nicht verfügbar** (nur vorbereitende Entwurfsdateien in `native/ios/`, siehe [docs/ios-widget.md](docs/ios-widget.md)).
