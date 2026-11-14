# Gestaltung von OpenNews

OpenNews ist eine ruhige, mobile Nachrichten-App. Eine Meldung zeigt ihre Quelle und, soweit bekannt, ihre Veröffentlichungszeit. Der Aufmacher gibt wichtigen Nachrichten Platz. Kompakte Zeilen helfen beim Überblick. Abschnitte haben klare Überschriften und enden an einer sichtbaren Stelle. Weitere Meldungen werden durch eine bewusste Aktion eingeblendet. Verzichte auf künstliche Dringlichkeit, automatisches Weiterscrollen und aufspringende Dekoration.

## Farben, Schrift und Raster

| Aufgabe | Hell | Dunkel |
| --- | --- | --- |
| App-Hintergrund `--canvas` | `#f6f5f2` | `#111214` |
| Karten und Gruppen `--panel` | `#fff` | `#1b1c20` |
| Bedienelemente `--control` | `#efeeeb` | `#25262b` |
| Text `--ink` | `#1e2024` | `#f6f5f3` |
| Metadaten `--muted` | `#555d66` | `#b4bbc5` |
| Trennlinie `--line` | `#d9d9d6` | `#41434a` |
| Auswahl und Fokus `--accent` | `#30343d` | `#eeeef0` |

Die App übernimmt die Systemschrift. Für Lesetext gibt es zusätzlich eine Serifenschrift. Verwende 0,875 rem für Metadaten, 1 rem für Fließtext, 1,25 rem für Abschnittsüberschriften und die gemeinsame Skala von 1,9 bis 2,75 rem für Seitentitel. Der Lesetext ist höchstens 66 Zeichenbreiten breit. Der App-Inhalt bleibt innerhalb von 72 rem. Nutze ein Raster mit 0,25 rem als Grundeinheit. Beginne bei einer Spalte und füge erst bei ausreichend Platz weitere Spalten hinzu. Respektiere die sicheren Bildschirmränder (Safe Areas).

`src/index.css` ist die Referenz für die Design-Werte. Karten verwenden `--card-radius` mit der gewählten Rundung. Für Pillen und Dialoge gibt es eigene zentrale Werte. Schatten kennzeichnen schwebende Ebenen. Verwende gemeinsame Farbwerte und Konturen. Quellfarben dürfen der Herkunft dienen. Statusfarben brauchen immer ein verständliches Textlabel.

## Bausteine

| Baustein | Regel |
| --- | --- |
| Lead | Ein Aufmacher mit klarer Überschrift. Text auf Fotos braucht einen dunklen Verlauf bis zur Textkante und eine deckende Ersatzfläche für fehlende Bilder. |
| Standard | Titel und Quelle bleiben auch bei einem fehlenden Bild sichtbar. Bildbereiche reservieren ihren Platz beim Laden. |
| Kompakt | Bild links, Text und Metadaten daneben. Merken und Liken haben eigene Tasten. |
| Medien | Audio hat einen klaren Wiedergabeknopf, Video ein ruhiges Vorschaubild. Hochformat nutzt seinen eigenen Vollbildbereich. |
| Buttons und Eingaben | `primary-action` für die Hauptaktion, `choice-pill` für Auswahl, `preference-input` für Eingaben. Jede Nur-Icon-Taste braucht einen zugänglichen Namen. |
| Tabs und Chips | Feste Anordnung beim Wechsel. Auswahl bleibt durch Farbe und Semantik (`aria-pressed` oder `aria-current`) erkennbar. |
| Einstellungen | Deckende Gruppen, eindeutige Namen und zusammengehörige Zeilen. Beschriftungen dürfen umbrechen. |
| Dialoge | Deckende Fläche, dunkler Hintergrund, sichtbares Schließen, Tastaturfokus und Rückkehr zum Auslöser. |
| Zustände | `ViewStatus` für fehlende oder noch ladende Inhalte. Im Kontext kurze Statusmeldung mit nächster Aktion, soweit möglich. Offline auf gespeicherte Inhalte verweisen. Ladeplatzhalter nur bei stabiler Geometrie. |
| Glas | Auf schwebender Navigation und schwebenden Tasten einsetzen. Textflächen und Einstellungen bleiben deckend. Bei reduzierter Transparenz deckende Oberfläche nutzen. |

Bewegung erklärt einen Wechsel oder die Reaktion auf eine Aktion. Für Druckreaktionen gelten 180 ms, für den Reader-Dialog 260 ms. Verwende die zentrale Kurve `--motion-ease`. Beachte reduzierte Bewegung im Betriebssystem und in der App. Setze auf kurze Übergänge und verzichte auf dekorative Dauerschleifen.

Normale Schrift braucht mindestens 4,5:1 Kontrast, große Schrift 3:1. Bedienelemente außerhalb von Fließtext sollen mindestens 44 × 44 CSS-Pixel treffen. Tastaturfokus ist sichtbar. Prüfe auch große Schrift, Umbruch bei 320 CSS-Pixeln und die Bedienung mit einem Screenreader. [WCAG-Kontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [Zielgröße](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)

## Bestandsaufnahme für Issue 71

| Fläche | Geprüfter Code und Änderung |
| --- | --- |
| Einrichtung und Profil | `Preferences.tsx`, `SettingsView.tsx`: vorhandene Einstellungsgruppen, Auswahlflächen und Schriftoptionen als Muster. |
| Heute, Für dich, Neueste | `HomeView.tsx`: Zustand und Segmentleiste haben eine feste Gestaltung. Zuvor wechselten Stil und Mindesthöhe mit dem gewählten Reiter. |
| Entdecken, Suche, Themen, Quellen | `DiscoverView.tsx`, `DiscoverSearch.tsx`: gemeinsamer Seitentitel und gemeinsamer Zustand für eine ergebnislose Suche. |
| Video und Audio | `MediaView.tsx`, `MediaPlayer.tsx`: Lade- und Leerzustand verwenden dieselbe Karte wie andere Ansichten. Vollbild und Player haben eigene Medienflächen. |
| Leseliste, Verlauf und Likes | `SavedView.tsx`: gemeinsamer Seitentitel und Leerzustand. |
| Reader, Medien und Teilen | `ArticleReaderModal.tsx`, `ArticleMedia.tsx`: Zusammenfassung erhält eine deckende Fläche und eine kürzere Bewegung. |
| Navigation und Rückmeldung | `App.tsx`, `PWAInstallButton.tsx`, `index.css`: gemeinsame Fokusregel, Ladeanzeige für nachgeladene Ansichten, bestehende Glas- und Safe-Area-Regeln. |

### Referenzen

- Apple beschreibt Glas als eigene Ebene über dem Inhalt und deckende Materialien für Inhaltsflächen. OpenNews übernimmt diese Trennung und bietet eine deckende Variante für Bedienelemente. [Apple Human Interface Guidelines – Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- Das Telemedienkonzept von ARD-aktuell beschreibt die redaktionell gewichtete Startseite der Tagesschau mit aktuellen Themen und mehreren Darstellungsformen. OpenNews verwendet ebenfalls einen klaren Aufmacher und getrennte Medienbereiche. [Telemedienkonzept](https://www.sr.de/statisch/Telemedienkonzepte_ARD.pdf)

Eine vollständige Vergleichsreihe der Konkurrenz sowie eine vollständige Vorher-nachher-Dokumentation aller Geräte und Zustände stehen aus.
