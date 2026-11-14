# Auswahl der Nachrichten

Stand 14. November 2026. Die Sortierung läuft lokal. Maßgeblich sind der Gerätekalender und die Veröffentlichungszeit aus dem Feed.

| Ansicht | Regeln |
| --- | --- |
| Heute | Ab lokaler Mitternacht bis jetzt. Grundwert 8 × exp(−Alter in Stunden/18). Politik, Europa, Wirtschaft und Wissenschaft erhalten 2 × exp(−Alter/12). Als Eilmeldung markierte Beiträge erhalten 8 × exp(−Alter/12). |
| Für dich | Jünger als 48 Stunden. Grundwert 12 × exp(−Alter/20). Themenpunkte sind auf ±3 begrenzt, Quell- und Stichwortpunkte auf jeweils ±1,5. Passende Stichwörter können bis zu 3 zusätzliche Punkte bringen. Diese Interessenpunkte verlieren mit exp(−Alter/24) an Gewicht. Eilmeldungen erhalten 14 × exp(−Alter/12), abonnierte Quellen 0,5 Punkte. Bereits gelesen kostet 3 Punkte, ausdrücklich abgewertete Artikel entfallen. Bei einem Profil mit positiven Interessen erhält eine wichtige Meldung ohne positive Themen-, Quell- oder Stichwortsignale aus den letzten 24 Stunden bei Bedarf Platz vier. Die Quellenobergrenze gilt weiter. |
| Neueste | Absteigend nach Veröffentlichungszeit. Artikel-ID entscheidet bei Gleichstand. Ungültige und zukünftige Zeitangaben entfallen in allen drei Ansichten. |

Gleiche Artikel-Links und IDs erscheinen einmal. Übereinstimmende normalisierte Titel ab zwei Wörtern werden innerhalb von 36 Stunden auch über Themen hinweg zusammengefasst. Ähnliche Überschriften derselben Kategorie werden bis 36 Stunden Abstand anhand gemeinsamer Wörter gruppiert. Der erste Treffer ist der sichtbare Artikel. Weitere Berichte bleiben aufklappbar. In „Neueste“ führt dadurch die jüngste Version. In den gewichteten Ansichten erfolgt die Gruppierung vor der Auswahl nach Vielfalt.

In beiden gewichteten Ansichten kosten eindeutige Teaser-Anfänge wie „Das glaubst du nie“ sechs Punkte. Berichtet eine weitere Quelle über dieselbe Geschichte, kommen bis zu zweimal 2 × exp(−Alter/18) Punkte hinzu. Der Bonus zählt unterschiedliche Feed-IDs. Er belegt keine redaktionelle Unabhängigkeit und kann auch mehrfach veröffentlichte Agenturtexte erfassen. Die enge Teaser-Regel lässt Artikel abrufbar und ist keine allgemeine Clickbait-Erkennung.

Die gewichteten Ansichten bilden Blöcke mit bis zu zwölf Plätzen. Jede bereits verwendete Quelle kostet innerhalb des Blocks zwei Punkte, jedes bereits verwendete Thema drei. Eine Quelle erhält höchstens zwei Plätze pro Block. Sind die übrigen Quellen erschöpft, beginnt ein neuer Block. So bleiben sämtliche Geschichten erreichbar, auch wenn nur eine Quelle abonniert ist. Die Oberfläche zeigt einen Grund, sobald ein starkes Interesse, eine Eilmeldung übergreifende Berichterstattung oder eine reservierte öffentliche Meldung erkannt wurde.

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
