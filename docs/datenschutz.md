# Datenschutzerklärung für OpenNews

**Entwurf für die Android-Veröffentlichung.** Der Betreiber ergänzt vor Freigabe seinen Namen, die Kontaktadresse und die tatsächlichen Angaben zu Hosting, Speicherdauer und eingesetzten Diensten.

## Daten auf dem Gerät

OpenNews speichert Quellen, Lesezeichen, Reaktionen, Leseverlauf, Interessen und Einstellungen auf dem Gerät. Die App nutzt diese Daten für die Anzeige und Empfehlungen. Du kannst die gelernten Gewichte in der App zurücksetzen. Die Android-Einstellungen können die lokalen App-Daten löschen. Im Browser kannst du die Website-Daten löschen.
Das Android-Widget speichert je Ansicht einen begrenzten Vorrat an Artikeldaten und seine Auswahl für Thema und Quelle im lokalen App-Speicher. Die periodische Darstellung des Widgets lädt keine Daten aus dem Internet. Das iOS-Widget erhält bis zu drei gekürzte Artikel pro Ansicht über einen gemeinsamen lokalen App-Speicher. Es ruft selbst keine Feeds ab.


## Abruf von Nachrichten und Medien

Die Android-App ruft Feeds und Artikel direkt ab. Beim Abruf können Quellen und Medienanbieter deine IP-Adresse und technische Verbindungsdaten sehen. Die Web-App verwendet für Feed- und Volltextabrufe einen OpenNews-Server. Der Server verarbeitet dafür die angeforderten Adressen und die zur Verbindung nötigen Daten. Eingebettete YouTube-Videos stellen eine Verbindung zu YouTube her. Die Artikelansicht verlinkt auch zur Originalquelle.

## Optionale Funktionen

- **Externe KI.** Wenn du eine KI-Funktion verwendest, erhält der ausgewählte Anbieter den Schlüssel zur Authentifizierung und die für die Anfrage benötigten Textinhalte. Im Web leitet der OpenNews-Server die KI-Anfrage weiter. Die Nutzung und Speicherdauer beim Anbieter richten sich nach dessen Bedingungen.
- **Android-Übersetzung.** Die App verwendet ML Kit. Benötigte Sprachmodelle werden von Google geladen. Die Übersetzung findet auf dem Gerät statt.
- **Android-Benachrichtigungen.** Bei eingerichteter Firebase-Konfiguration verwaltet Firebase Cloud Messaging die Zustellung an die App-Installation und ihre abonnierten Themen. Beim Aktivieren von Eilmeldungen oder der täglichen Erinnerung fragt OpenNews über Android nach der Berechtigung. Wenn Android die Benachrichtigungen sperrt, führt die App zu den Android-Einstellungen.

## Datenschutzkontakt und Betroffenenrechte

Der Betreiber ergänzt hier vor Veröffentlichung einen erreichbaren Datenschutzkontakt und die für den Betrieb geltenden Angaben zu Auskunft, Berichtigung, Löschung und Beschwerde.

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
Android unterstützt hier längere englische Artikel und einen Stichpunkt.

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
