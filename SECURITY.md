# Sicherheitsmeldungen

Melde vermutete Lücken vertraulich beim Repository-Inhaber [mixxermannipro](https://github.com/mixxermannipro). Wenn GitHub im Repository die private Meldung anbietet, nutze **Security → Report a vulnerability**. Andernfalls bitte den Inhaber über einen bestehenden Kontakt um einen vertraulichen Kanal.

Nenne die betroffene Version, den betroffenen Teil der App, die mögliche Auswirkung und die Voraussetzungen. Schwärze Zugangsdaten und persönliche Daten. Warte mit öffentlichen Details, bis die Behebung abgestimmt ist.

## KI und Quelleninhalte

OpenNews übergibt Artikel und Kurztexte als JSON in einem markierten Datenblock.
Der Auftrag an das Modell steht davor. Zusammenfassungen und Tagesüberblicke
werden vor der Anzeige oder Sprachausgabe auf Format und Länge geprüft.
Beim Tagesüberblick muss mindestens ein bekannter Quellenname vorkommen.
Diese Prüfungen begrenzen unerwartete Ausgaben. Die inhaltliche Treue der KI
zu den Quellen kann die App damit nur teilweise prüfen.

Der Test in `src/lib/aiClient.test.ts` prüft, dass ein präparierter Artikel
mit einem eingebetteten Trenner den Datenblock nicht verlassen kann.
