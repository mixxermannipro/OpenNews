# Android-Beta prüfen

## Stand und Reihenfolge

| Bereich | Stand vom 16. November 2026 | Abnahme |
| --- | --- | --- |
| Erster Nutzwert (#141) | Browser-Tests prüfen Onboarding und Feed mit vorbereiteten Antworten. | Frische Android-Installation, normales Netz. Zeit vom ersten App-Start bis zum ersten echten, aktuellen Nachrichtenüberblick messen. Richtwert 60 Sekunden. |
| Tägliche Nutzung (#141) | Heute, Für dich, Neueste und der Tagesüberblick sind vorhanden. Webtests prüfen Reiterwechsel und starten den vorgelesenen Überblick. | Aktualität, Quellenvielfalt, Dubletten und Auffindbarkeit auf dem Handy prüfen. Leere, langsame und fehlerhafte Feeds getrennt erfassen. |
| Lesen und Offline (#125, #141) | Browser-Tests decken Lesen, Merken, Offline-Lesen und die Migration des Verlaufs ab. | Im Android-Build Originalquelle, fehlende Bilder oder Volltexte, alte Installation und Widget-Einstieg prüfen. Zurück-Taste, große Schrift und TalkBack einschließen. |
| Paket und Store (#126–#130) | Signierbefehl, Store-Texte und Testablauf sind vorbereitet. | Endgültiges Paket, 16-KB-Gerät, Datenschutzseite mit Betreiberangaben, finaler Store-Eintrag und Console-Berichte prüfen. |
| Inhalte (#131) | News-Quellen, Artikelansicht und Original-Link sind vorhanden. | Rechte für Volltext, Feed-Teaser, Bilder, Logos und Store-Aufnahmen separat klären. Öffentliche Web-Bereitstellung hat eine eigene Server-Abnahme. |
| Weitere Themen (#44, #45, #72, #133) | iOS, Monetarisierung, breiter Ranking-Vergleich und weitergehende Clip-Änderungen sind offen. | Nach der Android-Beta priorisieren. Konkrete Befunde, die Lesen oder Erstnutzung wesentlich stören, in #125 oder #141 aufnehmen. |

## Vorprüfung mit echten Feeds

Am 16. November 2026 lud ein frisches Brave-Profil im Handyformat die lokal
gestartete Web-App mit echten Feeds. Nach **1,1 Sekunden** erschien eine
Tagesschau-Meldung vom selben Morgen (07:18 Uhr MEZ). Im ersten Feed-Block
waren 0 von 6 Quellen erfolgreich. Der nächste lieferte 138 Beiträge von
6 Quellen, davon 124 mit Veröffentlichung in den vorherigen 24 Stunden.
Das ist eine einzelne Web-Messung mit übersprungener Einrichtung. Der
Android-Abruf und die Ursache des leeren ersten Blocks sind separat zu prüfen.

## Interner Test

Mit wenigen vertrauten Testern beginnen. Neu installieren und später
über denselben Play-Testkanal aktualisieren. Pro Gerät die Version, Android-
Version und den Ausgang notieren. Bei einem Update bleiben gewählte Quellen,
Lesezeichen und Einstellungen erhalten. Mindestens Startseite, Leser,
Netzausfall, Zurück-Navigation und Benachrichtigungsablehnung prüfen.
Anschließend Play Console **Pre-launch report → Overview** auf Abstürze,
Blockaden und Darstellungsprobleme prüfen.

## Geschlossener Test

15–20 Personen aus dem eigenen Umfeld anfragen, die gelegentlich mehrere
Nachrichtenquellen lesen. Unterschiedliche Android-Versionen und Geräte
einbeziehen. Die Teilnehmer öffnen den Anmeldelink mit dem eingeladenen
Google-Konto, installieren die App und bleiben für die Testdauer angemeldet.
Eine Telefonnummer wird für die Teilnahme von OpenNews nicht erhoben.

- **Erster Start:** Stoppuhr starten, bis erstmals eine aktuelle echte
  Meldung sichtbar ist. Öffne eine Meldung und nenne den Reiter. Halte fest,
  wenn nach 60 Sekunden weiterhin kein aktueller Überblick sichtbar ist.
- **Rückkehr:** Am nächsten Tag und nach einer Woche freiwillig antworten,
  ob und warum du die App geöffnet hast. Wenn du wiederkehrst, markiere
  welchen Reiter du genutzt und ob du den Tagesüberblick gefunden oder
  angehört hast. Die Rücklaufzahl mit auswerten.
- **Fehler:** Private Rückmeldung über **Profil → Kontakt und Feedback** oder den Feedback-Kanal des Testtracks.
  Bitte um App-Version, Android-Version, Gerätetyp, Schritte, erwartetes
  und beobachtetes Ergebnis. Screenshots sind freiwillig. Persönliche
  Daten, API-Schlüssel und Zugangsdaten vor dem Teilen entfernen.
- **Auswertung:** Pro Aufgabe dokumentieren, wie viele Personen sie
  versuchten, wie viele sie abschlossen und bei welchen Geräten sie
  scheiterte. Erststartzeiten als Einzelwerte und Median erfassen.
  Fehlende Rückmeldungen separat zählen. Abstürze, Datenverlust,
  unbrauchbare Kernansichten und wiederholte schwere Ladefehler vor dem
  nächsten Rollout beheben und erneut prüfen.

Teilnehmerliste in Play Console pflegen. Im Repo nur anonymisierte
Ergebnisse und reproduzierbare Fehler dokumentieren.

[Google Play zu geschlossenen Tests](https://support.google.com/googleplay/android-developer/answer/14151465)
