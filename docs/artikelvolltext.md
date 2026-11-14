# Artikelvolltext

Web und Android extrahieren den redaktionellen Text mit Mozilla Readability. OpenNews zeigt Textabsätze und Zwischenüberschriften an. Bei einem fehlenden Volltext bleibt der Feed-Text mit Link zur Originalseite verfügbar. Der Web-Endpunkt liefert die Antwort mit `Cache-Control: no-store`. Er legt keine Artikelkopie auf dem Server ab.

Vor einer öffentlichen Veröffentlichung muss der Betreiber prüfen, für welche Quellen ein serverseitiger Abruf und die Wiedergabe in dieser Form erlaubt sind. Der Artikel-Link, die private Nutzung durch einzelne Leser und die Nutzung durch einen kommerziellen Dienst sind im Gesetz unterschiedlich geregelt. Zu prüfen sind außerdem die Nutzungsbedingungen der Quellen, Rechte an Bildern und der Umgang mit Zugangsgrenzen. Die Extraktion nutzt die öffentlich gelieferte Seite ohne Anmeldung. Die Freigabe für eine dauerhafte Offline-Kopie braucht eine separate Prüfung.

- [§ 87g UrhG – Rechte des Presseverlegers](https://www.gesetze-im-internet.de/urhg/__87g.html)
- [§ 53 UrhG – Vervielfältigungen zum privaten und sonstigen eigenen Gebrauch](https://www.gesetze-im-internet.de/urhg/__53.html)
- [Mozilla Readability](https://github.com/mozilla/readability)

Die Web-App legt Offline-Kopien nur auf ausdrücklichen Wunsch des Lesers im Browser ab. Der Artikel erscheint anschließend unter „Gespeichert“. Die App hält höchstens 30 Kopien. Das Titelbild wird mitgespeichert, wenn die Quelle den Bildabruf für die App erlaubt und die Datei in das Größenlimit passt. Die Kopie kann im Leser entfernt werden.
