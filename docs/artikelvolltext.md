# Artikelvolltext

Standardmäßig zeigt der OpenNews-Reader pro Quelle **nur den vom Feed gelieferten Kurztext** mit einem direkten Link zur Originalquelle an. Nutzer können den Volltext-Abruf je Quelle im Reader bewusst per Opt-in aktivieren (und jederzeit wieder ausschalten).

Bei aktiviertem Opt-in extrahieren Web und Android den redaktionellen Text (über Mozilla Readability bzw. `HTMLRewriter` auf Cloudflare Pages) und stellen Textabsätze und Zwischenüberschriften dar.

## Technische Schutzmaßnahmen

- **Kein serverseitiges Caching:** `/api/article/extract` liefert Antworten immer mit `Cache-Control: no-store` aus und legt keine extrahierten Volltexte auf dem Server ab.
- **Keine Paywall-Umgehung:** Sobald Paywall-Markup erkannt wird (`hasPaywallMarkup` in `src/lib/publisherPolicy.ts` bzw. `blockedWall`), wird kein Volltext extrahiert, sondern auf das Original verlinkt.
- **Robots-Richtlinien:** `X-Robots-Tag`-Header sowie `<meta name="robots|googlebot|bingbot|...">`-Angaben mit `noarchive`, `noai` oder `noimageai` werden respektiert; solche Seiten werden nicht extrahiert.
- **Transparenter User-Agent:** Abrufe identifizieren sich mit `OpenNews/1.0 (+https://opennews-app.pages.dev; RSS Reader)`.
- **Verlags-Opt-out:** Verlage können Domains per `DEFAULT_OPTOUT_DOMAINS` (`src/lib/publisherPolicy.ts`) oder Umgebungsvariable `OPENNEWS_OPTOUT_DOMAINS` dauerhaft sperren lassen. Siehe auch [Quellen und Nutzungsrechte](quellen-rechte.md).

## Hinweise zu Urheberrecht und Offline-Kopien

- [§ 87g UrhG – Rechte des Presseverlegers](https://www.gesetze-im-internet.de/urhg/__87g.html)
- [§ 53 UrhG – Vervielfältigungen zum privaten und sonstigen eigenen Gebrauch](https://www.gesetze-im-internet.de/urhg/__53.html)
- [Mozilla Readability](https://github.com/mozilla/readability)

Die Web-App legt Offline-Kopien nur auf ausdrücklichen Wunsch des Lesers im Browser ab. Der Artikel erscheint anschließend unter „Gespeichert“. Die App hält höchstens 30 Kopien. Das Titelbild wird mitgespeichert, wenn die Quelle den Bildabruf für die App erlaubt und die Datei in das Größenlimit passt. Die Kopie kann im Leser entfernt werden. Das Hintergrund-Vorladen (`offlinePreload.ts`) lädt ausschließlich Artikel aus Quellen mit aktiviertem Volltext-Opt-in.
