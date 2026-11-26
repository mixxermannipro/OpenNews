# Datenschutzerklärung für OpenNews

**Entwurf für die Android-Veröffentlichung.**

- Verantwortlicher: **[Name und ladungsfähige Anschrift]**
- Datenschutzkontakt: **mixxermannipropvp@gmail.com**
- Betreiber der Datenschutzseite, Hosting-Standort und Speicherdauer von
  Zugriffsprotokollen: **[nach Wahl des Hostings eintragen]**
- Rechtsgrundlagen je Verarbeitung, Empfänger und gegebenenfalls
  Übermittlungen in Drittländer: **[für den tatsächlichen Betrieb klären]**

Die eckigen Klammern brauchen bestätigte Angaben vor der Veröffentlichung.
Diese Pflichtangaben ergeben sich aus [Art. 13 DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/).

## Daten auf dem Gerät

OpenNews speichert Quellen, Lesezeichen, Reaktionen, Leseverlauf, Interessen und Einstellungen auf dem Gerät. Die App nutzt diese Daten für die Anzeige und Empfehlungen. Du kannst die gelernten Gewichte in der App zurücksetzen. Die Android-Einstellungen können die lokalen App-Daten löschen. Im Browser kannst du die Website-Daten löschen.
OpenNews deaktiviert die automatische Android-Cloud-Sicherung seiner App-Daten. Eine manuelle Sicherung ist über den Export in den Einstellungen möglich.
Das Android-Widget speichert je Ansicht bis zu 24 Meldungen mit ihrem Merkstatus sowie die abonnierten Feed-Adressen im lokalen App-Speicher. App-Sprache, Farbwahl, Filter-, Anzeige- und Aktualisierungseinstellungen jedes Widgets bleiben ebenfalls lokal. Wenn in den Widget-Einstellungen eine automatische Hintergrund-Aktualisierung aktiv ist (Standard: alle 30 Minuten; konfigurierbar zwischen Aus, 15 Min., 30 Min., 1 Std., 2 Std. und 4 Std.), ruft der Android-Dienst `WidgetRefreshService` die abonnierten Feeds bei bestehender Netzwerkverbindung direkt vom Gerät aus ab – ohne OpenNews-Server. Bei **Aus (nur manuell)** lädt das Widget im Hintergrund keine Daten aus dem Internet. Das iOS-Widget erhält bis zu drei gekürzte Artikel pro Ansicht über einen gemeinsamen lokalen App-Speicher. Es ruft selbst keine Feeds ab.
Die Android-Auto-Integration speichert Audio-Quellenauswahl, Autoplay- und Radio-Schalter, gespeicherte Radio-Favoriten, die Hör-Warteschlange, Abspielpositionen sowie zwischengespeicherte Episoden-Metadaten lokal im App-Speicher (`opennews-auto`). Beim Verbinden mit Android Auto oder bei aktivierter Direktaktualisierung im Fahrzeug ruft `OpenNewsAutoMediaService` / `AutoFeedFetcher` die Podcast-RSS-Feeds sowie Live-Radio-Streams direkt per HTTPS beim jeweiligen Sender bzw. Anbieter ab – ohne OpenNews-Server.


## Abruf von Nachrichten und Medien

Die Android-App ruft Feeds, Vorschaubilder und beim Öffnen eines Artikels nach Möglichkeit den Artikelvolltext direkt von der Quelle ab. Außerdem können eingebettete Medien (Audio, Video, YouTube) sowie Live-Nachrichtenradio-Streams per HTTPS direkt in der App bzw. in Android Auto abgespielt werden. Beim Abruf können Quellen, Radiosender und Medienanbieter deine IP-Adresse und technische Verbindungsdaten sehen. Die Web-App verwendet für Feed- und Volltextabrufe einen OpenNews-Server; Live-Radio-Streams und Audio-Dateien werden im Browser direkt vom jeweiligen Sender über HTTPS geladen. Der Server verarbeitet für Feed- und Artikelabrufe die angeforderten Adressen und die zur Verbindung nötigen Daten. Eingebettete YouTube-Videos stellen eine Verbindung zu YouTube her. Die Artikelansicht verlinkt auch zur Originalquelle. Radio-Favoriten bleiben lokal auf dem Gerät.

## Optionale Funktionen

- **Externe KI.** Wenn du eine externe KI konfigurierst, erhält der ausgewählte Dienst bei einer Anfrage den Schlüssel zur Authentifizierung (falls gesetzt) und die dafür benötigten Textinhalte. Mit aktivierter automatischer Zusammenfassung kann die Anfrage beim Öffnen eines Artikels erfolgen. Zur Auswahl stehen Google Gemini, OpenAI, Anthropic, Mistral AI sowie OpenRouter oder ein selbst eingetragener kompatibler Dienst. Im Web leitet der OpenNews-Server Anfragen weiter. Die Nutzung und Speicherdauer beim gewählten Dienst richten sich nach dessen Bedingungen.
- **Android-Übersetzung.** Die App verwendet ML Kit. Benötigte Sprachmodelle werden von Google geladen. Die Übersetzung findet auf dem Gerät statt. Google beschreibt Modellabrufe sowie Leistungs- und Nutzungsmetriken des SDK. Die Android-Übersetzung kann unter anderem Geräteinformationen, eine installationsbezogene Kennung und Angaben zur Sprachkonfiguration übertragen. Google nennt für die Übersetzung auch Firebase Remote Config und Firebase Installations zur Diagnose. Das betrifft ML Kit unabhängig von der Konfiguration von Firebase Cloud Messaging für Eilmeldungen. Eingabetext und Übersetzung verbleiben bei dieser Funktion auf dem Gerät. [ML-Kit-Datenschutzhinweise](https://developers.google.com/ml-kit/terms) · [Angaben zu ML Kit Translate](https://developers.google.com/ml-kit/android-data-disclosure)
- **Android-Benachrichtigungen.** Die vorgesehene erste Android-Beta enthält das SDK mit deaktivierter automatischer Messaging-Initialisierung und wird ohne Firebase-Projektkonfiguration gebaut. Die lokale Tageserinnerung bleibt verfügbar. Bei später eingerichteter Firebase-Konfiguration verwaltet Firebase Cloud Messaging die Zustellung an die App-Installation und ihre abonnierten Themen. Beim Aktivieren von Eilmeldungen oder der täglichen Erinnerung fragt OpenNews über Android nach der Berechtigung. Wenn Android die Benachrichtigungen sperrt, führt die App zu den Android-Einstellungen.

## Datenschutzkontakt und Betroffenenrechte

Für eine Anfrage zum Datenschutz nutze den oben genannten Kontakt.
Je nach Voraussetzungen hast du Rechte auf Auskunft, Berichtigung, Löschung,
Einschränkung der Verarbeitung und Datenübertragbarkeit. Du kannst dich bei
einer Datenschutzaufsichtsbehörde beschweren. Bei einwilligungsbasierter
Verarbeitung kannst du deine Einwilligung für die Zukunft widerrufen. Bei
einer Verarbeitung aufgrund berechtigter Interessen kann ein Widerspruchsrecht
bestehen.

## Kontakt und Beta-Feedback

**Profil → Kontakt und Feedback** öffnet einen Entwurf in deinem
E-Mail-Programm. OpenNews fügt den Betreff „OpenNews Beta“ ein. Text und
Anhänge bestimmst du selbst. Der Betreiber verarbeitet deine E-Mail-Adresse
und deine Nachricht zur Bearbeitung deiner Anfrage. **[Rechtsgrundlage und
Speicherdauer für Support-Nachrichten ergänzen.]**

## Freiwillige Fehlerdiagnose

Die optionale Diagnose speichert Fehlerarten und auf Stunden gerundete Zeiten lokal. Sie erfasst keine Artikel- oder Feed-Adressen, Schlüssel, Gerätekennungen oder Fehlertexte. Der Bericht bleibt auf deinem Gerät, bis du ihn selbst exportierst und weitergibst. Beim Ausschalten löscht OpenNews die gespeicherten Diagnoseeinträge.

Bei selbst betriebenen Web-Installationen kann der Betreiber den Empfang mit `OPENNEWS_DIAGNOSTICS=1` aktivieren. Nutzer müssen das Senden separat einschalten. Der Browser sendet nur die Fehlerart. Der Server schreibt diese mit der auf Stunden gerundeten Empfangszeit in sein Betriebsprotokoll. Das Diagnoseprotokoll enthält keine IP-Adresse, URL, Gerätekennung oder Fehlertexte. Beim Verbindungsaufbau ist die IP-Adresse für den Betreiber technisch sichtbar. Für den Diagnosepfad sollten im vorgeschalteten Webserver keine Zugriffsprotokolle geführt werden. Der Betreiber legt die Speicherdauer fest und dokumentiert sie vor Einsatz. Die Android-App verwendet weiterhin den lokalen Export.

KI-Ergebnisse aus Zusammenfassungen und Tagesüberblicken werden lokal in
IndexedDB gespeichert. Die Feed-Aufbewahrungsdauer gilt auch für diese
Ergebnisse (standardmäßig vier Tage). Unter **Gespeichert → Gelesen** löscht
„Verlauf und KI-Ergebnisse löschen“ beide Datensammlungen.

Bei **Frag den Artikel** erhält der eingerichtete KI-Anbieter die eingegebene
Frage und bis zu 12.000 Zeichen des ursprünglichen Artikeltexts. Antworten
werden wie Zusammenfassungen befristet auf dem Gerät gespeichert.

Beim **Perspektivenvergleich** erhält der eingerichtete KI-Anbieter
Überschriften, Quellennamen und Kurztexte von bis zu sechs Quellen derselben
Meldungsgruppe. Der Vergleich wird befristet auf dem Gerät gespeichert.

Beim **Wochenrückblick** wählt die App passende Lesezeichen und Likes lokal
aus. Erst beim Erstellen gehen bis zu acht Überschriften, Quellennamen und
Kurztexte an den eingerichteten KI-Anbieter. Das Ergebnis wird pro Woche und
Artikelauswahl befristet auf dem Gerät gespeichert.

Bei **Auf diesem Gerät** verarbeitet Gemini Nano Artikeltexte lokal. Chrome
benötigt die Prompt API, Android die ML-Kit-Schnittstelle und einen passenden
AICore-Dienst. Beim erstmaligen Start kann ein Modell-Download anfallen.
Android unterstützt hier längere englische Artikel und einen Stichpunkt. Google nennt für die Diagnose und Nutzungsanalyse von ML Kit GenAI unter anderem Kennungen sowie Sprach- und Leistungsdaten. [Angaben zu ML Kit GenAI](https://developers.google.com/ml-kit/android-data-disclosure#genai)

Die Android-Erinnerung für den Tagesüberblick wird auf dem Gerät geplant.
Uhrzeit, Einwilligung und die zuletzt geladene Schlagzeile bleiben lokal.
Beim Erinnern wird keine KI-Anfrage ausgelöst. Android kann die Zustellung
im Stromsparmodus verzögern.

Bei **Transkript zusammenfassen** lädt OpenNews eine vom Feed angegebene
Datei (VTT, SRT oder Text) über HTTPS. Im Web vermittelt der OpenNews-Server,
auf Android ruft das Gerät die Datei direkt ab. An die eingerichtete KI gehen
der Titel und bis zu 18.000 Zeichen des Transkripts. Das Ergebnis bleibt
befristet im lokalen KI-Speicher. OpenNews transkribiert keine Audio- oder
Videospuren und ruft keine im YouTube-Player eingebetteten Untertitel ab.
