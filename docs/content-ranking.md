# Auswahl der Nachrichten

Stand 25. November 2026. Die Sortierung läuft lokal. Maßgeblich sind der Gerätekalender und die Veröffentlichungszeit aus dem Feed.

| Ansicht | Regeln |
| --- | --- |
| Heute | Ab lokaler Mitternacht bis jetzt (zwischen 00:00 und 06:00 Uhr bei weniger als acht Tagesmeldungen mit sanfter Ergänzung aus den letzten 18 Stunden). Grundwert 8 × exp(−Alter in Stunden/18). Politik, Europa, Wirtschaft und Wissenschaft erhalten 2 × exp(−Alter/12), illustrierte und inhaltsreiche Beiträge ein leichtes Qualitätsplus. Als Eilmeldung markierte Beiträge erhalten 8 × exp(−Alter/12). Als Anzeige/Werbung gekennzeichnete Beiträge entfallen in Heute und Für dich, Deal- und Quiz-Meldungen werden stark abgewertet. |
| Für dich | Jünger als 48 Stunden (ohne Anzeigen). Grundwert 12 × exp(−Alter/20). Themenpunkte sind auf ±3 begrenzt, Quell- und Stichwortpunkte auf jeweils ±1,5. Passende Stichwörter können bis zu 3 zusätzliche Punkte bringen. Diese Interessenpunkte verlieren mit exp(−Alter/24) an Gewicht. Eilmeldungen erhalten 14 × exp(−Alter/12), abonnierte Quellen 0,5 Punkte. Bereits gelesen kostet 3 Punkte, ausdrücklich abgewertete Artikel entfallen. Bei einem Profil mit positiven Interessen erhält eine wichtige Meldung ohne positive Themen-, Quell- oder Stichwortsignale aus den letzten 24 Stunden bei Bedarf Platz vier. Die Quellenobergrenze gilt weiter. |
| Neueste | Absteigend nach Veröffentlichungszeit ohne Filterung von Anzeigen oder Gewichtung. Artikel-ID entscheidet bei Gleichstand. Ungültige und zukünftige Zeitangaben entfallen in allen drei Ansichten. |

Gleiche Artikel-Links und IDs erscheinen einmal. Übereinstimmende normalisierte Titel ab zwei Wörtern werden innerhalb von 36 Stunden auch über Themen hinweg zusammengefasst. Ähnliche Überschriften werden über Wortstämme, Komposita und normalisierte Zahlen gebündelt — innerhalb derselben Kategorie bis 36 Stunden Abstand, mit strengeren Schwellen auch kategorieübergreifend bis 24 Stunden. In „Neueste“ führt die jüngste Version. In den gewichteten Ansichten („Heute“ und „Für dich“) werden doppelte Meldungen derselben Quelle innerhalb einer Gruppe bereinigt, der redaktionell stärkste Beitrag (mit Bild und aussagekräftigem Teaser, bevorzugt keine Liveblogs) als Aufmacher gewählt und die Bündelung vor der Auswahl nach Vielfalt ausgeführt.

In beiden gewichteten Ansichten kosten eindeutige Teaser-Anfänge wie „Das glaubst du nie“ sechs Punkte; Shopping-Deals, Quizze und Stream-Promos kosten acht Punkte. Berichten weitere Quellen über dieselbe Geschichte, kommen bis zu viermal 2,4 × exp(−Alter/18) Punkte hinzu. Der Bonus zählt unterschiedliche Feed-IDs. Er belegt keine redaktionelle Unabhängigkeit und kann auch mehrfach veröffentlichte Agenturtexte erfassen.

Bei neu eingelesenen Meldungen bestimmt eine bekannte Ressortangabe des Feeds zuerst das Thema. Wenn sie fehlt, wertet OpenNews zuerst die Überschrift (inkl. deutscher Komposita und klarer Trennung von Sport vs. Europa) und erst danach die Beschreibung aus. Ein Artikel zur Bundespräsidentenwahl zählt auch dann zu Politik, wenn er einen Sportler erwähnt.

Die gewichteten Ansichten bilden Blöcke mit bis zu zwölf Plätzen. Jede bereits verwendete Quelle kostet innerhalb des Blocks vier Punkte, jedes bereits verwendete Thema drei. Eine Quelle erhält höchstens zwei Plätze pro Block. Sind die übrigen Quellen erschöpft, beginnt ein neuer Block. So bleiben sämtliche Geschichten erreichbar, auch wenn nur eine Quelle abonniert ist. Die Oberfläche zeigt einen Grund, sobald ein starkes Interesse, eine Eilmeldung, übergreifende Berichterstattung oder eine reservierte öffentliche Meldung erkannt wurde.

## Ausgangslage und Nachweis

Zuvor wurden ähnliche Berichte erst nach der Auswahl der Reihenfolge zusammengefasst. Dadurch beanspruchten sie vorher Plätze bei der Berechnung der Vielfalt. Die Quellenstrafe war weich und eine Serie hoch bewerteter Meldungen konnte trotz vorhandener anderer Quellen vorn bleiben.

Die Tests in `src/lib/newsFeed.test.ts` bilden einen festen Beispieltag mit fünf starken Meldungen derselben Quelle und drei Meldungen anderer Quellen nach. Die ersten fünf Plätze decken jetzt vier Quellen und vier Themen ab. Ein zweiter Test prüft den neuesten Bericht je Geschichte sowie ungültige und zukünftige Zeitstempel. Die Datensätze sind künstlich. Sie erlauben keine Aussage zur durchschnittlichen Vielfalt echter Nachrichtenfeeds.

## Vergleich veröffentlichter Produktregeln

| Produkt | Belegtes Muster | Entscheidung für OpenNews |
| --- | --- | --- |
| Google News | Thematische Schlagzeilen und personalisierte Bereiche. „Full Coverage“ bündelt Perspektiven. Google nennt Aktualität und Relevanz als Signale. | Getrennte Bereiche für Tagesagenda und Interessen. Weitere Quellen pro Geschichte bleiben erreichbar. [Google News zur Auswahl](https://support.google.com/googlenews/answer/9005749) · [Google News zur Rangfolge](https://support.google.com/news/publisher-center/answer/9606702) |
| Threads | Empfehlungen und chronologischer Feed abonnierter Profile sind eigene Ansichten. | Chronologie und Empfehlungen bekommen getrennte Reiter. [Meta zur Einführung von Threads](https://about.fb.com/news/2023/07/introducing-threads-new-app-text-sharing/) |

Die Tabelle stützt sich auf Produktdokumentation. Die erste mobile Stichprobe und der Vergleich mit echten Feeds stehen in [Benchmark zu Issue 72](benchmark-72.md). Mehrtägige Beobachtungen, ein direkter quantitativer Vergleich mit den Wettbewerbern und verlässliche Regionssignale fehlen noch.

## Mehrtägige Messung

Pro Angebot und Ansicht an mindestens drei verschiedenen Tagen zu denselben lokalen Uhrzeiten die ersten zwölf redaktionellen Beiträge erfassen. Einen frischen Zustand getrennt von einem bestehenden, personalisierten Profil erfassen. Vermerken, wenn ein Angebot oder eine Ansicht im gewählten Land fehlt, eine Anmeldung verlangt oder wegen eines Abos nicht geöffnet werden kann. Region, Gerätesprache, Plattform und Zeitpunkt festhalten.

Je Beitrag Position, Überschrift, kanonische URL, sichtbare Quelle, Thema, Format, sichtbare Veröffentlichungszeit und eine mögliche Empfehlungserklärung erfassen. Je Ansicht eine Aufnahme mit Zeitpunkt ablegen. Werbung, Widgets und Navigation separat vermerken. Bei fehlender Zeitangabe die Alterskennzahl nur für Beiträge mit sichtbarer Zeit berechnen und den Anteil fehlender Zeiten dazuschreiben.

| Kennzahl | Berechnung je Ansicht und Zeitpunkt |
| --- | --- |
| Quellen und Themen | Anzahl verschiedener Quellen und Themen in den ersten zwölf Beiträgen |
| Dominanz | Anteil der häufigsten Quelle unter den sichtbaren Beiträgen |
| Aktualität | Median des Alters in Stunden und Anteil der Meldungen unter 24 Stunden |
| Doppelte Geschichten | Anteil zusätzlicher Karten, die von derselben Nachricht handeln. Verwandte Artikel innerhalb einer Karte separat zählen. |
| Personalisierung | Anteil, der zu vorher festgelegten Interessen passt. Sichtbare Empfehlungserklärungen zusätzlich zählen. |

Für Vorher und Nachher denselben Feed-Datensatz und dieselbe Uhrzeit verwenden. Die personalisierte Ansicht mit einem festen lokalen Profil auswerten. Je Ansicht auch die Laufzeit der Auswahl protokollieren. Ergebnisse über die Tage zusammenfassen und Messwerte aus öffentlichen Ansichten getrennt von personalisierten Stichproben ausweisen.
